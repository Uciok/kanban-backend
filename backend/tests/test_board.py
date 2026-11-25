import json

import pytest

from app import db


def test_db_created_on_startup(client):
    assert db.DB_PATH.exists()


def test_default_board_on_first_read(signed_in):
    response = signed_in.get("/api/board")
    assert response.status_code == 200
    assert response.json() == json.loads(db.DEFAULT_BOARD)


def test_save_and_read_back(signed_in):
    board = signed_in.get("/api/board").json()
    board["columns"][0]["title"] = "Ideas"
    board["columns"][0]["cardIds"].remove("card-1")
    board["columns"][1]["cardIds"].append("card-1")
    board["cards"]["card-2"]["details"] = "Edited"

    assert signed_in.put("/api/board", json=board).status_code == 200
    assert signed_in.get("/api/board").json() == board


def test_board_survives_logout(signed_in):
    board = signed_in.get("/api/board").json()
    del board["cards"]["card-3"]
    board["columns"][1]["cardIds"] = []
    signed_in.put("/api/board", json=board)

    signed_in.post("/api/auth/logout")
    signed_in.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert signed_in.get("/api/board").json() == board


def test_invalid_board_rejected(signed_in):
    response = signed_in.put("/api/board", json={"columns": [{"id": "col-a"}], "cards": {}})
    assert response.status_code == 422
    assert signed_in.get("/api/board").json() == json.loads(db.DEFAULT_BOARD)


@pytest.mark.parametrize("change", ["dangling card id", "card in two columns", "card in no column", "key mismatch"])
def test_inconsistent_board_rejected(signed_in, change):
    board = signed_in.get("/api/board").json()
    if change == "dangling card id":
        board["columns"][0]["cardIds"].append("card-ghost")
    elif change == "card in two columns":
        board["columns"][1]["cardIds"].append("card-1")
    elif change == "card in no column":
        board["columns"][0]["cardIds"].remove("card-1")
    else:
        board["cards"]["card-1"]["id"] = "card-other"

    assert signed_in.put("/api/board", json=board).status_code == 422
    assert signed_in.get("/api/board").json() == json.loads(db.DEFAULT_BOARD)


def test_board_requires_sign_in(client):
    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json=json.loads(db.DEFAULT_BOARD)).status_code == 401


def test_boards_are_per_user(client):
    board = db.get_board("user")
    board["cards"]["card-1"]["title"] = "Only for user"
    db.save_board("user", board)

    assert db.get_board("other")["cards"]["card-1"]["title"] == "Align roadmap themes"
    assert db.get_board("user")["cards"]["card-1"]["title"] == "Only for user"
