# Backend

FastAPI app managed with uv (Python 3.13).

- `app/main.py` - app, API routes under `/api`, static files mounted at `/` (mounted last so API routes win). Creates the db on startup (lifespan)
- `app/db.py` - SQLite (stdlib `sqlite3`): `init_db` (creates tables, runs `PRAGMA user_version` migrations, seeds the demo user), users (`create_user`, `authenticate`, `check_user_password`, scrypt `hash_password` / `check_password`, `set_password`, `delete_user`) and boards (`list_boards` gives a user with no boards the demo board, `create_board` makes an empty board with the default columns, `get_board` / `save_board` / `rename_board` / `delete_board`, all scoped to the user; `save_board` writes the board and its activity events in one transaction, `rename_board` returns the board summary) and activity (`add_events`, `list_events`). Path from `DB_PATH`, default `data/app.db`. See `docs/DATABASE.md`
- `app/models.py` - Pydantic `Board` / `Column` / `Card`, same shape as the frontend `BoardData`. `Card` has optional `priority` (`low`/`medium`/`high`/null), `dueDate` (`YYYY-MM-DD`/null) `labels` (up to 8, each 1-24 chars after trimming) and `checklist` (up to 20 `{id, text, done}` items, unique ids, text 1-120 chars); boards saved before these existed load with the defaults. A `Board` has 1-12 columns with unique ids; column titles are trimmed, 1-60 chars. `Board` also checks consistency: every card in exactly one column, no dangling card ids, `cards` keys equal card ids (422 on `PUT /api/boards/{id}`)
- `app/activity.py` - `describe_changes(old, new)`: short summaries of what a save changed (cards added / moved / edited / deleted, checklist updated, columns added / renamed / removed / reordered; reordering cards within a column is not logged; more than 10 changes become "Made N changes")
- `app/default_board.json` - demo board given to new users; its columns are used for new boards
- `app/ai.py` - OpenRouter via the `openai` SDK. Model `openai/gpt-oss-120b`, then any `OPENROUTER_FALLBACK_MODELS` (comma-separated) as OpenRouter's `models` fallback list. Key from `OPENROUTER_API_KEY`. Client timeout 60s with 1 retry. Only the last 20 history messages are sent. The system prompt describes the card fields and includes today's date; it goes through `str.format`, so literal braces must be doubled. `AICard` / `AIColumn` / `AIChecklistItem` (all fields required, no defaults or length limits, as strict structured outputs need) is what the AI returns; `apply_update` validates it into `Card`s. `chat` sends the board + history + message and parses a strict structured output (`ChatResult`: `reply`, `board` or null, cards as a list) with `provider.require_parameters` set. OpenRouter failures (network, timeout, rate limit, bad or missing key) and model refusals also raise `AIError`. `apply_update` rejects column changes, a card sent twice, and boards that fail the `Board` consistency check (`AIError`). Tests mock `ai.chat`, `ai.ask` or `ai.client`
- `static/` - files served at `/`. Not in git: the Dockerfile copies the Next export (`frontend/out`) here. To serve the frontend outside Docker, copy `frontend/out` to `backend/static`
- `tests/` - pytest, using FastAPI `TestClient`. `conftest.py` points `DB_PATH` at a temp file per test and has `client`, `signed_in` (demo user), `board_id` (demo user's first board) and `other_client` (a second session) fixtures

Routes (all except health, register and login need a session; another user's board is 404):
- `GET /api/health` -> `{"status": "ok"}`
- `POST /api/auth/register` `{username, password}` -> 201 `{username}` and signs in. Username 3-32 of `[A-Za-z0-9_.-]`, password 8-128 chars (422); 409 if taken
- `POST /api/auth/login` `{username, password}` -> `{username}`; 401 on bad credentials
- `POST /api/auth/logout` -> clears the session
- `GET /api/auth/me` -> `{username}` or 401
- `POST /api/auth/password` `{current_password, new_password}` -> 204; 403 if the current password is wrong
- `DELETE /api/auth/me` `{password}` -> 204, deletes the user and their boards (cascade); 403 if the password is wrong
- `GET /api/boards` -> `[{id, name, updated_at}]`, oldest first
- `POST /api/boards` `{name}` -> 201 summary. Names are stripped, 1-80 chars
- `GET /api/boards/{id}` -> `{id, name, board}`
- `PUT /api/boards/{id}` full board -> saves and returns it (422 if invalid or inconsistent)
- `PATCH /api/boards/{id}` `{name}` -> summary
- `DELETE /api/boards/{id}` -> 204; 409 for the user's only board
- `GET /api/boards/{id}/activity` -> `[{id, summary, created_at, username}]`, latest 50, newest first. Recorded on board create, rename (when the name changes), every `PUT` (via `describe_changes` against the stored board) and AI updates (prefixed "AI: ")
- `POST /api/ai/test` -> `{answer}` from asking the model "What is 2+2?" (connectivity check)
- `POST /api/boards/{id}/chat` `{message, history: [{role: user|assistant, content}]}` -> `{reply, board | null}`; saves the board when the AI changes it; 502 with `detail` if the AI is unavailable, refuses, its response is unreadable or the update is invalid

Auth: Starlette `SessionMiddleware` (signed cookie) holding `user_id`. Secret from `SESSION_SECRET`, random per start if unset. `current_user` also checks the user still exists, so a deleted account's other sessions end. Protect routes with the `UserId` dependency.

Commands (from `backend/`):
- `uv run pytest` - tests (`--cov=app` for coverage)
- `uv run uvicorn app.main:app --reload` - local dev server on 8000

In Docker the app runs from `/app` with the venv at `/app/.venv`; data lives in `/app/data` (volume).
