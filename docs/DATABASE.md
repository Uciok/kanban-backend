# Database

SQLite file at `data/app.db` (Docker volume `pm-data`, mounted at `/app/data`). Path set by `DB_PATH`. Created with its tables on startup if missing.

## Approach

Each board is stored as one JSON document in the same shape the frontend uses (`BoardData`). The backend reads and writes a board's contents whole (`GET` / `PUT /api/boards/{id}`), and the AI works with the same JSON.

Relational tables for columns and cards are not needed: boards are small and there are no queries across cards.

## Schema

Version 2 (`PRAGMA user_version = 2`):

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT,            -- "scrypt$<salt hex>$<hash hex>"
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data TEXT NOT NULL,            -- BoardData JSON
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS boards_user_id ON boards(user_id);

CREATE TABLE IF NOT EXISTS board_events (
  id INTEGER PRIMARY KEY,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,          -- e.g. 'Moved "X" from Backlog to Done'
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP  -- UTC
);
CREATE INDEX IF NOT EXISTS board_events_board_id ON board_events(board_id);
```

- `board_events`: the activity log. Deleted with its board or user

- `users`: the demo user `user` is inserted on startup and given the password `password` if it has none. Passwords are hashed with stdlib `hashlib.scrypt` (n=2^14, r=8, p=1, 16-byte salt)
- `boards`: many per user. A user with no boards gets the demo board ("My board") when their boards are first listed; new boards get the demo board's columns with no cards. Deleting a user deletes their boards (`PRAGMA foreign_keys = ON` per connection)

## Migrations

`init_db` reads `PRAGMA user_version`. Version 0 with an existing `boards` table is the MVP schema (one board per user, `UNIQUE(user_id)`, no names or passwords); it is migrated in place: `users` gains `password_hash`, `boards` is rebuilt with `name` ("My board") and `created_at`, keeping ids and data. Version 1 to 2 only adds `board_events`, which `CREATE TABLE IF NOT EXISTS` handles. Add new migrations as further version steps.

## Board JSON (`boards.data`)

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"] },
    { "id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"] },
    { "id": "col-progress", "title": "In Progress", "cardIds": ["card-4", "card-5"] },
    { "id": "col-review", "title": "Review", "cardIds": ["card-6"] },
    { "id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"] }
  ],
  "cards": {
    "card-1": { "id": "card-1", "title": "Align roadmap themes", "details": "Draft quarterly themes with impact statements and metrics." }
  }
}
```

Cards also have `priority` (`"low"` / `"medium"` / `"high"` / `null`), `dueDate` (`"YYYY-MM-DD"` or `null`) `labels` (list of strings) and `checklist` (list of `{id, text, done}`). Boards stored before these fields existed are read with the defaults (`null`, `null`, `[]`, `[]`), so no migration is needed. (`cards` abbreviated.) A board has 1-12 columns with unique ids. Column order is the array order, card order within a column is `cardIds` order. The backend validates this shape with Pydantic on every save.
