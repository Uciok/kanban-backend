import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "data" / "app.db")


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


@pytest.fixture
def signed_in(client):
    client.post("/api/auth/login", json={"username": "user", "password": "password"})
    return client


@pytest.fixture
def board_id(signed_in) -> int:
    # The demo user's first board
    return signed_in.get("/api/boards").json()[0]["id"]


@pytest.fixture
def other_client():
    # A second, independent browser session
    with TestClient(app) as client:
        yield client
