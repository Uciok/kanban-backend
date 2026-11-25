from fastapi.testclient import TestClient

from app.main import app


def login(client, username="user", password="password"):
    return client.post("/api/auth/login", json={"username": username, "password": password})


def test_login_and_me():
    client = TestClient(app)
    response = login(client)
    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    assert client.get("/api/auth/me").json() == {"username": "user"}


def test_invalid_credentials():
    client = TestClient(app)
    assert login(client, password="wrong").status_code == 401
    assert login(client, username="admin").status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_me_without_session():
    assert TestClient(app).get("/api/auth/me").status_code == 401


def test_logout_clears_session():
    client = TestClient(app)
    login(client)
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401
