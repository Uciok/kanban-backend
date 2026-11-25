import json

import pytest

from app import ai, db
from app.models import Board


def default_board() -> dict:
    return json.loads(db.DEFAULT_BOARD)


def test_add_reorder_and_remove_columns(signed_in, board_id):
    board = default_board()
    board["columns"].append({"id": "col-blocked", "title": "Blocked", "cardIds": []})
    board["columns"][0], board["columns"][1] = board["columns"][1], board["columns"][0]
    del board["columns"][3]["cardIds"][:]  # Review is now empty...
    del board["cards"]["card-6"]
    board["columns"].pop(3)  # ...and removed

    assert signed_in.put(f"/api/boards/{board_id}", json=board).status_code == 200
    saved = signed_in.get(f"/api/boards/{board_id}").json()["board"]
    assert [c["title"] for c in saved["columns"]] == ["Discovery", "Backlog", "In Progress", "Done", "Blocked"]


@pytest.mark.parametrize(
    "change",
    ["no columns", "duplicate column id", "blank title", "long title", "too many columns"],
)
def test_invalid_columns_rejected(signed_in, board_id, change):
    board = default_board()
    if change == "no columns":
        board = {"columns": [], "cards": {}}
    elif change == "duplicate column id":
        board["columns"].append({"id": "col-done", "title": "Done again", "cardIds": []})
    elif change == "blank title":
        board["columns"][0]["title"] = "   "
    elif change == "long title":
        board["columns"][0]["title"] = "x" * 61
    else:
        board["columns"] += [{"id": f"col-extra-{i}", "title": f"Extra {i}", "cardIds": []} for i in range(8)]

    assert signed_in.put(f"/api/boards/{board_id}", json=board).status_code == 422
    assert signed_in.get(f"/api/boards/{board_id}").json()["board"] == default_board()


def test_column_titles_are_trimmed(signed_in, board_id):
    board = default_board()
    board["columns"][0]["title"] = "  Ideas  "
    signed_in.put(f"/api/boards/{board_id}", json=board)
    assert signed_in.get(f"/api/boards/{board_id}").json()["board"]["columns"][0]["title"] == "Ideas"


def test_ai_must_keep_user_added_columns(signed_in, board_id, monkeypatch):
    # The user added a column; the AI must keep it (it compares against the stored board)
    board = default_board()
    board["columns"].append({"id": "col-blocked", "title": "Blocked", "cardIds": []})
    signed_in.put(f"/api/boards/{board_id}", json=board)

    without_new_column = Board.model_validate(default_board())
    proposed = ai.AIBoard.model_validate(
        {
            "columns": without_new_column.model_dump()["columns"],
            "cards": [card.model_dump() for card in without_new_column.cards.values()],
        }
    )
    monkeypatch.setattr(ai, "chat", lambda *args: ai.ChatResult(reply="Done", board=proposed))

    response = signed_in.post(f"/api/boards/{board_id}/chat", json={"message": "Tidy up"})

    assert response.status_code == 502
    assert len(signed_in.get(f"/api/boards/{board_id}").json()["board"]["columns"]) == 6
