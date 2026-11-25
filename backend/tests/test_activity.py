import json
import sqlite3

import pytest

from app import activity, ai, db
from app.models import Board


def default_board() -> dict:
    return json.loads(db.DEFAULT_BOARD)


def describe(change) -> list[str]:
    old = default_board()
    new = default_board()
    change(new)
    return activity.describe_changes(Board.model_validate(old), Board.model_validate(new))


def add_card(board):
    board["cards"]["card-9"] = {"id": "card-9", "title": "New idea", "details": ""}
    board["columns"][1]["cardIds"].append("card-9")


def move_card(board):
    board["columns"][0]["cardIds"].remove("card-1")
    board["columns"][4]["cardIds"].append("card-1")


def edit_card(board):
    board["cards"]["card-2"]["priority"] = "low"


def tick_item(board):
    board["cards"]["card-1"]["checklist"][1]["done"] = True


def delete_card(board):
    del board["cards"]["card-6"]
    board["columns"][3]["cardIds"].remove("card-6")


def add_column(board):
    board["columns"].append({"id": "col-x", "title": "Blocked", "cardIds": []})


def rename_column(board):
    board["columns"][0]["title"] = "Ideas"


def remove_column(board):
    delete_card(board)
    board["columns"].pop(3)


def reorder_columns(board):
    board["columns"].reverse()


def reorder_cards_in_column(board):
    board["columns"][0]["cardIds"].reverse()


@pytest.mark.parametrize(
    "change,expected",
    [
        (add_card, ['Added card "New idea" to Discovery']),
        (move_card, ['Moved "Align roadmap themes" from Backlog to Done']),
        (edit_card, ['Edited card "Gather customer signals"']),
        (tick_item, ['Updated the checklist on "Align roadmap themes"']),
        (delete_card, ['Deleted card "QA micro-interactions"']),
        (add_column, ['Added column "Blocked"']),
        (rename_column, ['Renamed column "Backlog" to "Ideas"']),
        (remove_column, ['Removed column "Review"', 'Deleted card "QA micro-interactions"']),
        (reorder_columns, ["Reordered columns"]),
        (reorder_cards_in_column, []),
        (lambda board: None, []),
    ],
)
def test_describe_changes(change, expected):
    assert describe(change) == expected


def test_many_changes_are_summarised():
    def many(board):
        for n in range(11):
            board["cards"][f"card-x{n}"] = {"id": f"card-x{n}", "title": f"Card {n}", "details": ""}
            board["columns"][0]["cardIds"].append(f"card-x{n}")

    assert describe(many) == ["Made 11 changes"]


def events(client, board_id) -> list[str]:
    response = client.get(f"/api/boards/{board_id}/activity")
    assert response.status_code == 200
    return [event["summary"] for event in response.json()]


def test_saves_are_recorded_newest_first(signed_in, board_id):
    board = default_board()
    edit_card(board)
    signed_in.put(f"/api/boards/{board_id}", json=board)
    move_card(board)
    signed_in.put(f"/api/boards/{board_id}", json=board)
    signed_in.put(f"/api/boards/{board_id}", json=board)  # no change, no event

    assert events(signed_in, board_id) == [
        'Moved "Align roadmap themes" from Backlog to Done',
        'Edited card "Gather customer signals"',
    ]
    event = signed_in.get(f"/api/boards/{board_id}/activity").json()[0]
    assert event["username"] == "user"
    assert event["created_at"]


def test_board_create_and_rename_are_recorded(signed_in, board_id):
    created = signed_in.post("/api/boards", json={"name": "Launch"}).json()["id"]
    signed_in.patch(f"/api/boards/{created}", json={"name": "Launch plan"})
    signed_in.patch(f"/api/boards/{created}", json={"name": "Launch plan"})  # same name, no event
    assert events(signed_in, created) == ['Renamed the board to "Launch plan"', "Created the board"]
    assert events(signed_in, board_id) == []


def test_ai_changes_are_marked(signed_in, board_id, monkeypatch):
    board = Board.model_validate(default_board())
    cards = [card.model_dump() for card in board.cards.values()]
    cards[1]["priority"] = "high"
    proposed = ai.AIBoard.model_validate({"columns": board.model_dump()["columns"], "cards": cards})
    monkeypatch.setattr(ai, "chat", lambda *args: ai.ChatResult(reply="Done", board=proposed))

    signed_in.post(f"/api/boards/{board_id}/chat", json={"message": "Raise it"})

    assert events(signed_in, board_id) == ['AI: Edited card "Gather customer signals"']


def test_activity_is_limited_to_50(signed_in, board_id):
    user_id = db.authenticate("user", "password")
    db.add_events(user_id, board_id, [f"Event {n}" for n in range(60)])
    summaries = events(signed_in, board_id)
    assert len(summaries) == 50
    assert summaries[0] == "Event 59"


def test_activity_is_private_and_needs_sign_in(signed_in, board_id, client, other_client):
    other_client.post("/api/auth/register", json={"username": "mallory", "password": "secret-pass"})
    assert other_client.get(f"/api/boards/{board_id}/activity").status_code == 404
    signed_in.post("/api/auth/logout")
    assert client.get(f"/api/boards/{board_id}/activity").status_code == 401


def test_events_go_with_their_board(signed_in, board_id):
    second = signed_in.post("/api/boards", json={"name": "Second"}).json()["id"]
    signed_in.delete(f"/api/boards/{second}")
    with db.connect() as conn:
        assert conn.execute("SELECT COUNT(*) FROM board_events WHERE board_id = ?", (second,)).fetchone()[0] == 0


def test_version_1_database_gets_the_activity_table(tmp_path, monkeypatch):
    path = tmp_path / "v1.db"
    conn = sqlite3.connect(path)
    conn.executescript(
        """
        CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE boards (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        PRAGMA user_version = 1;
        """
    )
    conn.close()
    monkeypatch.setattr(db, "DB_PATH", path)

    db.init_db("user", "password")

    with db.connect() as conn:
        assert conn.execute("PRAGMA user_version").fetchone()[0] == 2
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert "board_events" in tables
