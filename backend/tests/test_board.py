import json
import sqlite3

import pytest

from app import db


def default_board() -> dict:
    return json.loads(db.DEFAULT_BOARD)


def test_db_created_on_startup(client):
    assert db.DB_PATH.exists()


def test_new_user_gets_the_demo_board(signed_in):
    boards = signed_in.get("/api/boards").json()
    assert [b["name"] for b in boards] == ["My board"]
    detail = signed_in.get(f"/api/boards/{boards[0]['id']}").json()
    assert detail["name"] == "My board"
    assert detail["board"] == default_board()


def test_list_does_not_duplicate_the_demo_board(signed_in):
    signed_in.get("/api/boards")
    assert len(signed_in.get("/api/boards").json()) == 1


def test_create_board_has_columns_and_no_cards(signed_in, board_id):
    response = signed_in.post("/api/boards", json={"name": "  Launch plan  "})
    assert response.status_code == 201
    created = response.json()
    assert created["name"] == "Launch plan"

    board = signed_in.get(f"/api/boards/{created['id']}").json()["board"]
    assert [c["title"] for c in board["columns"]] == [c["title"] for c in default_board()["columns"]]
    assert board["cards"] == {}
    assert [b["name"] for b in signed_in.get("/api/boards").json()] == ["My board", "Launch plan"]


@pytest.mark.parametrize("name", ["", "   ", "x" * 81])
def test_board_name_validation(signed_in, board_id, name):
    assert signed_in.post("/api/boards", json={"name": name}).status_code == 422
    assert signed_in.patch(f"/api/boards/{board_id}", json={"name": name}).status_code == 422


def test_save_and_read_back(signed_in, board_id):
    board = default_board()
    board["columns"][0]["title"] = "Ideas"
    board["columns"][0]["cardIds"].remove("card-1")
    board["columns"][1]["cardIds"].append("card-1")
    board["cards"]["card-2"]["details"] = "Edited"

    assert signed_in.put(f"/api/boards/{board_id}", json=board).status_code == 200
    assert signed_in.get(f"/api/boards/{board_id}").json()["board"] == board


def test_boards_are_saved_separately(signed_in, board_id):
    second = signed_in.post("/api/boards", json={"name": "Second"}).json()["id"]
    board = default_board()
    board["cards"]["card-1"]["title"] = "Only on the first board"
    signed_in.put(f"/api/boards/{board_id}", json=board)

    assert signed_in.get(f"/api/boards/{second}").json()["board"]["cards"] == {}


def test_board_survives_logout(signed_in, board_id):
    board = default_board()
    del board["cards"]["card-3"]
    board["columns"][1]["cardIds"] = []
    signed_in.put(f"/api/boards/{board_id}", json=board)

    signed_in.post("/api/auth/logout")
    signed_in.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert signed_in.get(f"/api/boards/{board_id}").json()["board"] == board


def test_rename_board(signed_in, board_id):
    response = signed_in.patch(f"/api/boards/{board_id}", json={"name": "Roadmap"})
    assert response.status_code == 200
    assert response.json()["name"] == "Roadmap"
    assert signed_in.get("/api/boards").json()[0]["name"] == "Roadmap"


def test_delete_board(signed_in, board_id):
    second = signed_in.post("/api/boards", json={"name": "Second"}).json()["id"]
    assert signed_in.delete(f"/api/boards/{board_id}").status_code == 204
    assert [b["id"] for b in signed_in.get("/api/boards").json()] == [second]
    assert signed_in.get(f"/api/boards/{board_id}").status_code == 404


def test_cannot_delete_the_only_board(signed_in, board_id):
    response = signed_in.delete(f"/api/boards/{board_id}")
    assert response.status_code == 409
    assert signed_in.get(f"/api/boards/{board_id}").status_code == 200


def test_missing_board_is_404(signed_in, board_id):
    assert signed_in.get("/api/boards/9999").status_code == 404
    assert signed_in.put("/api/boards/9999", json=default_board()).status_code == 404
    assert signed_in.patch("/api/boards/9999", json={"name": "X"}).status_code == 404
    assert signed_in.delete("/api/boards/9999").status_code == 404


def test_invalid_board_rejected(signed_in, board_id):
    response = signed_in.put(f"/api/boards/{board_id}", json={"columns": [{"id": "col-a"}], "cards": {}})
    assert response.status_code == 422
    assert signed_in.get(f"/api/boards/{board_id}").json()["board"] == default_board()


@pytest.mark.parametrize("change", ["dangling card id", "card in two columns", "card in no column", "key mismatch"])
def test_inconsistent_board_rejected(signed_in, board_id, change):
    board = default_board()
    if change == "dangling card id":
        board["columns"][0]["cardIds"].append("card-ghost")
    elif change == "card in two columns":
        board["columns"][1]["cardIds"].append("card-1")
    elif change == "card in no column":
        board["columns"][0]["cardIds"].remove("card-1")
    else:
        board["cards"]["card-1"]["id"] = "card-other"

    assert signed_in.put(f"/api/boards/{board_id}", json=board).status_code == 422
    assert signed_in.get(f"/api/boards/{board_id}").json()["board"] == default_board()


def test_boards_require_sign_in(client):
    assert client.get("/api/boards").status_code == 401
    assert client.post("/api/boards", json={"name": "X"}).status_code == 401
    assert client.get("/api/boards/1").status_code == 401
    assert client.put("/api/boards/1", json=default_board()).status_code == 401
    assert client.patch("/api/boards/1", json={"name": "X"}).status_code == 401
    assert client.delete("/api/boards/1").status_code == 401


def test_users_cannot_reach_each_others_boards(signed_in, board_id, other_client):
    other_client.post("/api/auth/register", json={"username": "mallory", "password": "secret-pass"})
    others = other_client.get("/api/boards").json()
    assert [b["id"] for b in others] != [board_id]

    assert other_client.get(f"/api/boards/{board_id}").status_code == 404
    assert other_client.put(f"/api/boards/{board_id}", json=default_board()).status_code == 404
    assert other_client.patch(f"/api/boards/{board_id}", json={"name": "Mine"}).status_code == 404
    assert other_client.delete(f"/api/boards/{board_id}").status_code == 404
    assert other_client.post(f"/api/boards/{board_id}/chat", json={"message": "Hi"}).status_code == 404
    assert signed_in.get(f"/api/boards/{board_id}").json()["name"] == "My board"


def test_migrates_the_single_board_schema(tmp_path, monkeypatch):
    # A database created by the MVP (Parts 5-11): UNIQUE user_id, no names, no passwords
    path = tmp_path / "old.db"
    old_board = default_board()
    old_board["cards"]["card-1"]["title"] = "Kept through the migration"
    conn = sqlite3.connect(path)
    conn.executescript(
        """
        CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE boards (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
          data TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        INSERT INTO users (username) VALUES ('user');
        """
    )
    conn.execute("INSERT INTO boards (user_id, data) VALUES (1, ?)", (json.dumps(old_board),))
    conn.commit()
    conn.close()
    monkeypatch.setattr(db, "DB_PATH", path)

    db.init_db("user", "password")
    db.init_db("user", "password")  # running again is a no-op

    user_id = db.authenticate("user", "password")
    assert user_id == 1
    boards = db.list_boards(user_id)
    assert [b["name"] for b in boards] == ["My board"]
    assert db.get_board(user_id, boards[0]["id"])["board"] == old_board
    # A second board is now allowed
    db.create_board(user_id, "Second")
    assert len(db.list_boards(user_id)) == 2


def test_demo_password_is_not_reset_on_restart(client):
    user_id = db.authenticate("user", "password")
    db.set_password(user_id, "changed-pass")
    db.init_db("user", "password")
    assert db.authenticate("user", "password") is None
    assert db.authenticate("user", "changed-pass") == user_id
