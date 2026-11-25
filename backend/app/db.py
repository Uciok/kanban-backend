import json
import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(os.environ.get("DB_PATH", Path(__file__).parent.parent / "data" / "app.db"))
DEFAULT_BOARD = (Path(__file__).parent / "default_board.json").read_text()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    # One transaction per call; commits on success, always closes
    conn = sqlite3.connect(DB_PATH)
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init_db(seed_user: str) -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)
        conn.execute("INSERT OR IGNORE INTO users (username) VALUES (?)", (seed_user,))


def user_id(conn: sqlite3.Connection, username: str) -> int:
    conn.execute("INSERT OR IGNORE INTO users (username) VALUES (?)", (username,))
    return conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()[0]


def get_board(username: str) -> dict:
    with connect() as conn:
        uid = user_id(conn, username)
        row = conn.execute("SELECT data FROM boards WHERE user_id = ?", (uid,)).fetchone()
        if row is None:
            conn.execute("INSERT INTO boards (user_id, data) VALUES (?, ?)", (uid, DEFAULT_BOARD))
            return json.loads(DEFAULT_BOARD)
        return json.loads(row[0])


def save_board(username: str, board: dict) -> None:
    with connect() as conn:
        uid = user_id(conn, username)
        conn.execute(
            """
            INSERT INTO boards (user_id, data) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
            """,
            (uid, json.dumps(board)),
        )
