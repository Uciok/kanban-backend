# Database

SQLite file at `data/app.db` (Docker volume `pm-data`, mounted at `/app/data`). Path set by `DB_PATH`. Created with its tables on startup if missing.

## Approach

Each user's board is stored as one JSON document in the same shape the frontend uses (`BoardData`). The backend reads and writes the whole board at once. This keeps the API to two board routes (`GET` / `PUT /api/board`) and lets the AI work with the same JSON.

Relational tables for columns and cards are not needed for the MVP: one board per user, small boards, no queries across cards.

## Schema

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  data TEXT NOT NULL,  -- BoardData JSON
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- `users`: `user` is inserted on startup. Passwords stay hardcoded for the MVP, so there is no password column yet
- `boards.user_id` is `UNIQUE`: one board per user. Multiple boards later means dropping that constraint and adding a `name`
- A user without a board gets the default board (the current demo data: 5 columns, 8 cards) on first read

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

(`cards` abbreviated.) Column order is the array order, card order within a column is `cardIds` order. The backend validates this shape with Pydantic on every save.
