import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(os.environ.get("DB_PATH", Path(__file__).parent.parent / "data" / "app.db"))
DEFAULT_BOARD = (Path(__file__).parent / "default_board.json").read_text()
SCHEMA_VERSION = 2

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS boards_user_id ON boards(user_id);

-- Version 2: activity log, one row per change
CREATE TABLE IF NOT EXISTS board_events (
  id INTEGER PRIMARY KEY,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS board_events_board_id ON board_events(board_id);
"""

# Version 0 -> 1: users get password_hash; boards get name/created_at and lose UNIQUE(user_id)
MIGRATE_V1 = """
ALTER TABLE users ADD COLUMN password_hash TEXT;

CREATE TABLE boards_v1 (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO boards_v1 (id, user_id, name, data, updated_at)
  SELECT id, user_id, 'My board', data, updated_at FROM boards;
DROP TABLE boards;
ALTER TABLE boards_v1 RENAME TO boards;
"""


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    # One transaction per call; commits on success, always closes
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def scrypt(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    return f"scrypt${salt.hex()}${scrypt(password, salt).hex()}"


def check_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    _, salt, digest = stored.split("$")
    return hmac.compare_digest(scrypt(password, bytes.fromhex(salt)).hex(), digest)


def empty_board() -> dict:
    # Same columns as the demo board, no cards
    board = json.loads(DEFAULT_BOARD)
    return {
        "columns": [{**column, "cardIds": []} for column in board["columns"]],
        "cards": {},
    }


def init_db(seed_user: str, seed_password: str) -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        if version == 0 and "boards" in tables:
            conn.executescript(MIGRATE_V1)
        conn.executescript(SCHEMA)
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        conn.execute("INSERT OR IGNORE INTO users (username) VALUES (?)", (seed_user,))
        # Hashing is slow, so only do it when the seed user has no password yet
        needs_password = conn.execute(
            "SELECT 1 FROM users WHERE username = ? AND password_hash IS NULL", (seed_user,)
        ).fetchone()
        if needs_password:
            conn.execute(
                "UPDATE users SET password_hash = ? WHERE username = ?", (hash_password(seed_password), seed_user)
            )


# Users


def create_user(username: str, password: str) -> int | None:
    """Returns the new user id, or None if the username is taken."""
    with connect() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, hash_password(password)),
            )
        except sqlite3.IntegrityError:
            return None
        return cursor.lastrowid


def authenticate(username: str, password: str) -> int | None:
    """Returns the user id if the credentials are valid."""
    with connect() as conn:
        row = conn.execute("SELECT id, password_hash FROM users WHERE username = ?", (username,)).fetchone()
    if row and check_password(password, row["password_hash"]):
        return row["id"]
    return None


def check_user_password(user_id: int, password: str) -> bool:
    with connect() as conn:
        row = conn.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
    return row is not None and check_password(password, row["password_hash"])


def get_username(user_id: int) -> str | None:
    with connect() as conn:
        row = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
    return row["username"] if row else None


def set_password(user_id: int, password: str) -> None:
    with connect() as conn:
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(password), user_id))


def delete_user(user_id: int) -> None:
    # Boards go with it (ON DELETE CASCADE)
    with connect() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))


# Boards


def list_boards(user_id: int) -> list[dict]:
    """The user's boards, oldest first. A user with no boards gets the demo board."""
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO boards (user_id, name, data)
            SELECT ?, 'My board', ?
            WHERE NOT EXISTS (SELECT 1 FROM boards WHERE user_id = ?)
            """,
            (user_id, DEFAULT_BOARD, user_id),
        )
        rows = conn.execute(
            "SELECT id, name, updated_at FROM boards WHERE user_id = ? ORDER BY id", (user_id,)
        ).fetchall()
    return [dict(row) for row in rows]


def create_board(user_id: int, name: str) -> dict:
    with connect() as conn:
        row = conn.execute(
            "INSERT INTO boards (user_id, name, data) VALUES (?, ?, ?) RETURNING id, name, updated_at",
            (user_id, name, json.dumps(empty_board())),
        ).fetchone()
    return dict(row)


def get_board(user_id: int, board_id: int) -> dict | None:
    """Returns {id, name, board} or None if the board does not exist or is not the user's."""
    with connect() as conn:
        row = conn.execute(
            "SELECT id, name, data FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
        ).fetchone()
    if row is None:
        return None
    return {"id": row["id"], "name": row["name"], "board": json.loads(row["data"])}


def save_board(user_id: int, board_id: int, board: dict, summaries: list[str]) -> None:
    """Saves the board and records its activity events in one transaction."""
    with connect() as conn:
        conn.execute(
            "UPDATE boards SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            (json.dumps(board), board_id, user_id),
        )
        insert_events(conn, user_id, board_id, summaries)


def rename_board(user_id: int, board_id: int, name: str) -> dict | None:
    """Returns the board's summary, or None if the board does not exist or is not the user's."""
    with connect() as conn:
        row = conn.execute(
            """
            UPDATE boards SET name = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
            RETURNING id, name, updated_at
            """,
            (name, board_id, user_id),
        ).fetchone()
    return dict(row) if row else None


def count_boards(user_id: int) -> int:
    with connect() as conn:
        return conn.execute("SELECT COUNT(*) FROM boards WHERE user_id = ?", (user_id,)).fetchone()[0]


def delete_board(user_id: int, board_id: int) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id))


# Activity


def insert_events(conn: sqlite3.Connection, user_id: int, board_id: int, summaries: list[str]) -> None:
    conn.executemany(
        "INSERT INTO board_events (board_id, user_id, summary) VALUES (?, ?, ?)",
        [(board_id, user_id, summary) for summary in summaries],
    )


def add_events(user_id: int, board_id: int, summaries: list[str]) -> None:
    with connect() as conn:
        insert_events(conn, user_id, board_id, summaries)


def list_events(user_id: int, board_id: int, limit: int = 50) -> list[dict]:
    """Newest first, only for the user's own board."""
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT e.id, e.summary, e.created_at, u.username
            FROM board_events e
            JOIN boards b ON b.id = e.board_id
            JOIN users u ON u.id = e.user_id
            WHERE e.board_id = ? AND b.user_id = ?
            ORDER BY e.id DESC
            LIMIT ?
            """,
            (board_id, user_id, limit),
        ).fetchall()
    return [dict(row) for row in rows]
