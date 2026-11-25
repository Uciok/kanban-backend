import pytest


def login(client, username="user", password="password"):
    return client.post("/api/auth/login", json={"username": username, "password": password})


def register(client, username="alice", password="secret-pass"):
    return client.post("/api/auth/register", json={"username": username, "password": password})


def test_login_and_me(client):
    response = login(client)
    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    assert client.get("/api/auth/me").json() == {"username": "user"}


@pytest.mark.parametrize("username,password", [("user", "wrong"), ("nobody", "password"), ("", "")])
def test_invalid_credentials(client, username, password):
    response = login(client, username, password)
    assert response.status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_me_without_session(client):
    assert client.get("/api/auth/me").status_code == 401


def test_logout_clears_session(signed_in):
    signed_in.post("/api/auth/logout")
    assert signed_in.get("/api/auth/me").status_code == 401


def test_register_signs_in(client):
    response = register(client)
    assert response.status_code == 201
    assert response.json() == {"username": "alice"}
    assert client.get("/api/auth/me").json() == {"username": "alice"}


def test_registered_user_can_log_in_again(client):
    register(client)
    client.post("/api/auth/logout")
    assert login(client, "alice", "secret-pass").status_code == 200
    assert login(client, "alice", "wrong-pass").status_code == 401


def test_register_taken_username(client):
    register(client)
    response = register(client, password="another-pass")
    assert response.status_code == 409
    assert register(client, username="user").status_code == 409


@pytest.mark.parametrize(
    "username,password",
    [("ab", "secret-pass"), ("a" * 33, "secret-pass"), ("bad name", "secret-pass"), ("alice", "short")],
)
def test_register_validation(client, username, password):
    assert register(client, username, password).status_code == 422


def test_passwords_are_hashed(client):
    from app import db

    register(client)
    with db.connect() as conn:
        stored = conn.execute("SELECT password_hash FROM users WHERE username = 'alice'").fetchone()[0]
    assert stored.startswith("scrypt$")
    assert "secret-pass" not in stored


def test_change_password(client):
    register(client)
    response = client.post(
        "/api/auth/password", json={"current_password": "secret-pass", "new_password": "new-secret"}
    )
    assert response.status_code == 204
    client.post("/api/auth/logout")
    assert login(client, "alice", "secret-pass").status_code == 401
    assert login(client, "alice", "new-secret").status_code == 200


def test_change_password_wrong_current(client):
    register(client)
    response = client.post(
        "/api/auth/password", json={"current_password": "wrong-pass", "new_password": "new-secret"}
    )
    assert response.status_code == 403
    assert login(client, "alice", "secret-pass").status_code == 200


def test_change_password_too_short(client):
    register(client)
    response = client.post("/api/auth/password", json={"current_password": "secret-pass", "new_password": "x"})
    assert response.status_code == 422


def test_change_password_requires_sign_in(client):
    response = client.post("/api/auth/password", json={"current_password": "a", "new_password": "new-secret"})
    assert response.status_code == 401


def test_delete_account(client, other_client):
    register(client)
    login(other_client, "alice", "secret-pass")

    response = client.request("DELETE", "/api/auth/me", json={"password": "secret-pass"})

    assert response.status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    # Other sessions of the deleted user end too
    assert other_client.get("/api/boards").status_code == 401
    assert login(client, "alice", "secret-pass").status_code == 401
    # The username can be used again
    assert register(client).status_code == 201


def test_delete_account_removes_boards(client):
    from app import db

    register(client)
    client.get("/api/boards")
    client.post("/api/boards", json={"name": "Second"})
    client.request("DELETE", "/api/auth/me", json={"password": "secret-pass"})
    with db.connect() as conn:
        assert conn.execute("SELECT COUNT(*) FROM boards").fetchone()[0] == 0


def test_delete_account_wrong_password(client):
    register(client)
    response = client.request("DELETE", "/api/auth/me", json={"password": "wrong-pass"})
    assert response.status_code == 403
    assert client.get("/api/auth/me").json() == {"username": "alice"}


def test_user_without_password_cannot_log_in(client):
    from app import db

    # Users migrated from the MVP other than the demo user have no password
    with db.connect() as conn:
        conn.execute("INSERT INTO users (username) VALUES ('legacy')")
    assert login(client, "legacy", "").status_code == 401
    assert login(client, "legacy", "password").status_code == 401
