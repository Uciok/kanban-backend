# Backend

FastAPI app managed with uv (Python 3.13).

- `app/main.py` - app, API routes under `/api`, static files mounted at `/` (mounted last so API routes win)
- `static/` - files served at `/`. Not in git: the Dockerfile copies the Next export (`frontend/out`) here. To serve the frontend outside Docker, copy `frontend/out` to `backend/static`
- `tests/` - pytest, using FastAPI `TestClient`

Routes:
- `GET /api/health` -> `{"status": "ok"}`
- `POST /api/auth/login` `{username, password}` -> `{username}` and sets the session cookie; 401 on bad credentials (hardcoded `user` / `password`)
- `POST /api/auth/logout` -> clears the session
- `GET /api/auth/me` -> `{username}` or 401

Auth: Starlette `SessionMiddleware` (signed cookie). Secret from `SESSION_SECRET`, random per start if unset (sessions then end on restart). Protect routes with `Depends(current_user)`.

Commands (from `backend/`):
- `uv run pytest` - tests (`--cov=app` for coverage)
- `uv run uvicorn app.main:app --reload` - local dev server on 8000

In Docker the app runs from `/app` with the venv at `/app/.venv`; data lives in `/app/data` (volume).
