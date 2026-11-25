import json
from datetime import date
from types import SimpleNamespace

import pytest

from app import ai, db
from app.models import Board


def default_board() -> dict:
    return json.loads(db.DEFAULT_BOARD)


def test_cards_saved_before_the_new_fields_load_with_defaults(signed_in, board_id):
    old = default_board()
    for card in old["cards"].values():
        del card["priority"], card["dueDate"], card["labels"]
    # Written straight to the database, as boards saved by older versions are
    user_id = db.authenticate("user", "password")
    db.save_board(user_id, board_id, old, [])

    card = signed_in.get(f"/api/boards/{board_id}").json()["board"]["cards"]["card-1"]
    assert card["priority"] is None
    assert card["dueDate"] is None
    assert card["labels"] == []


def test_card_fields_round_trip(signed_in, board_id):
    board = default_board()
    board["cards"]["card-1"].update(priority="low", dueDate="2026-12-31", labels=[" urgent ", "client"])

    response = signed_in.put(f"/api/boards/{board_id}", json=board)

    assert response.status_code == 200
    saved = signed_in.get(f"/api/boards/{board_id}").json()["board"]["cards"]["card-1"]
    assert saved["priority"] == "low"
    assert saved["dueDate"] == "2026-12-31"
    assert saved["labels"] == ["urgent", "client"]


@pytest.mark.parametrize(
    "field,value",
    [
        ("priority", "urgent"),
        ("dueDate", "2026-13-01"),
        ("dueDate", "20261201"),
        ("dueDate", "2026-W01-1"),
        ("dueDate", "next week"),
        ("labels", ["x" * 25]),
        ("labels", ["   "]),
        ("labels", [f"l{i}" for i in range(9)]),
    ],
)
def test_invalid_card_fields_rejected(signed_in, board_id, field, value):
    board = default_board()
    board["cards"]["card-1"][field] = value
    assert signed_in.put(f"/api/boards/{board_id}", json=board).status_code == 422


def test_ai_can_set_card_fields(signed_in, board_id, monkeypatch):
    board = Board.model_validate(default_board())
    proposed = ai.AIBoard.model_validate(
        {
            "columns": board.model_dump()["columns"],
            "cards": [
                {**card.model_dump(), **({"priority": "high", "dueDate": "2026-12-01", "labels": ["ai"]} if card.id == "card-2" else {})}
                for card in board.cards.values()
            ],
        }
    )
    monkeypatch.setattr(ai, "chat", lambda *args: ai.ChatResult(reply="Done", board=proposed))

    response = signed_in.post(f"/api/boards/{board_id}/chat", json={"message": "Make it urgent"})

    assert response.status_code == 200
    card = signed_in.get(f"/api/boards/{board_id}").json()["board"]["cards"]["card-2"]
    assert (card["priority"], card["dueDate"], card["labels"]) == ("high", "2026-12-01", ["ai"])


def test_ai_invalid_card_field_rejected(signed_in, board_id, monkeypatch):
    board = Board.model_validate(default_board())
    cards = [card.model_dump() for card in board.cards.values()]
    cards[0]["dueDate"] = "soon"
    proposed = ai.AIBoard.model_validate({"columns": board.model_dump()["columns"], "cards": cards})
    monkeypatch.setattr(ai, "chat", lambda *args: ai.ChatResult(reply="Done", board=proposed))

    response = signed_in.post(f"/api/boards/{board_id}/chat", json={"message": "Due soon"})

    assert response.status_code == 502
    assert response.json()["detail"] == "The AI returned an invalid board, so the update was not applied"
    assert signed_in.get(f"/api/boards/{board_id}").json()["board"] == default_board()


def test_prompt_describes_fields_and_today(monkeypatch):
    calls = []

    def parse(**kwargs):
        calls.append(kwargs)
        result = ai.ChatResult(reply="Hi", board=None)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(parsed=result))])

    fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(parse=parse)))
    monkeypatch.setattr(ai, "client", lambda: fake)
    ai.chat(Board.model_validate(default_board()), [], "Hi")

    system = calls[0]["messages"][0]["content"]
    assert f"Today is {date.today().isoformat()}." in system
    assert "dueDate" in system and "priority" in system and "labels" in system
    assert "{id, text, done}" in system  # braces survive str.format


@pytest.mark.parametrize("model", [ai.AICard, ai.AIColumn, ai.AIChecklistItem])
def test_ai_schemas_are_plain(model):
    # Strict structured outputs need every field required, no defaults and no length limits
    schema = model.model_json_schema()
    assert set(schema["required"]) == set(schema["properties"])
    text = json.dumps(schema)
    for keyword in ("default", "minLength", "maxLength", "minItems", "maxItems"):
        assert keyword not in text


def test_checklist_round_trip_and_defaults(signed_in, board_id):
    board = default_board()
    board["cards"]["card-2"]["checklist"] = [
        {"id": "a", "text": "  Call five customers  ", "done": True},
        {"id": "b", "text": "Summarise"},
    ]
    assert signed_in.put(f"/api/boards/{board_id}", json=board).status_code == 200
    saved = signed_in.get(f"/api/boards/{board_id}").json()["board"]["cards"]
    assert saved["card-2"]["checklist"] == [
        {"id": "a", "text": "Call five customers", "done": True},
        {"id": "b", "text": "Summarise", "done": False},
    ]
    assert saved["card-3"]["checklist"] == []


@pytest.mark.parametrize(
    "checklist",
    [
        [{"id": "a", "text": "   "}],
        [{"id": "a", "text": "x" * 121}],
        [{"id": "a", "text": "One"}, {"id": "a", "text": "Two"}],
        [{"id": f"i{n}", "text": "Item"} for n in range(21)],
    ],
)
def test_invalid_checklists_rejected(signed_in, board_id, checklist):
    board = default_board()
    board["cards"]["card-2"]["checklist"] = checklist
    assert signed_in.put(f"/api/boards/{board_id}", json=board).status_code == 422


def test_ai_can_tick_checklist_items(signed_in, board_id, monkeypatch):
    board = Board.model_validate(default_board())
    cards = [card.model_dump() for card in board.cards.values()]
    cards[0]["checklist"][1]["done"] = True
    proposed = ai.AIBoard.model_validate({"columns": board.model_dump()["columns"], "cards": cards})
    monkeypatch.setattr(ai, "chat", lambda *args: ai.ChatResult(reply="Ticked", board=proposed))

    assert signed_in.post(f"/api/boards/{board_id}/chat", json={"message": "Tick it"}).status_code == 200
    checklist = signed_in.get(f"/api/boards/{board_id}").json()["board"]["cards"]["card-1"]["checklist"]
    assert [item["done"] for item in checklist] == [True, True, False]
