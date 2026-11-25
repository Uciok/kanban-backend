# Backend

FastAPI app managed with uv (Python 3.13).

- `app/main.py` - app, API routes under `/api`, static files mounted at `/` (mounted last so API routes win). Creates the db on startup (lifespan)
- `app/db.py` - SQLite (stdlib `sqlite3`): `init_db`, `get_board` (creates the default board on first read), `save_board`. Path from `DB_PATH`, default `data/app.db`. See `docs/DATABASE.md`
- `app/models.py` - Pydantic `Board` / `Column` / `Card`, same shape as the frontend `BoardData`
- `app/default_board.json` - board given to new users
- `app/ai.py` - OpenRouter via the `openai` SDK. Model `openai/gpt-oss-120b`, then any `OPENROUTER_FALLBACK_MODELS` (comma-separated) as OpenRouter's `models` fallback list. Key from `OPENROUTER_API_KEY`. `chat` sends the board + history + message and parses a strict structured output (`ChatResult`: `reply`, `board` or null, cards as a list) with `provider.require_parameters` set. OpenRouter failures (network, timeout, rate limit, bad or missing key) and model refusals also raise `AIError`. `apply_update` rejects column changes and cards not in exactly one column (`AIError`). Tests mock `ai.chat`, `ai.ask` or `ai.client`
- `static/` - files served at `/`. Not in git: the Dockerfile copies the Next export (`frontend/out`) here. To serve the frontend outside Docker, copy `frontend/out` to `backend/static`
- `tests/` - pytest, using FastAPI `TestClient`. `conftest.py` points `DB_PATH` at a temp file per test and has `client` / `signed_in` fixtures

Routes:
- `GET /api/health` -> `{"status": "ok"}`
- `POST /api/auth/login` `{username, password}` -> `{username}` and sets the session cookie; 401 on bad credentials (hardcoded `user` / `password`)
- `POST /api/auth/logout` -> clears the session
- `GET /api/auth/me` -> `{username}` or 401
- `GET /api/board` -> the user's board (401 if signed out)
- `PUT /api/board` full board -> saves and returns it (422 if invalid)
- `POST /api/ai/test` -> `{answer}` from asking the model "What is 2+2?" (connectivity check)
- `POST /api/chat` `{message, history: [{role: user|assistant, content}]}` -> `{reply, board | null}`; saves the board when the AI changes it; 502 with `detail` if the AI is unavailable, refuses, its response is unreadable or the update is invalid

Auth: Starlette `SessionMiddleware` (signed cookie). Secret from `SESSION_SECRET`, random per start if unset (sessions then end on restart). Protect routes with `Depends(current_user)`.

Commands (from `backend/`):
- `uv run pytest` - tests (`--cov=app` for coverage)
- `uv run uvicorn app.main:app --reload` - local dev server on 8000

In Docker the app runs from `/app` with the venv at `/app/.venv`; data lives in `/app/data` (volume).
