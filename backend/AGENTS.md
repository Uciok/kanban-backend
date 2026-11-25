# Backend

FastAPI app managed with uv (Python 3.13).

- `app/main.py` - app, API routes under `/api`, static files mounted at `/` (mounted last so API routes win)
- `static/` - files served at `/` (temporary hello world page, replaced by the Next export in Part 3)
- `tests/` - pytest, using FastAPI `TestClient`

Routes:
- `GET /api/health` -> `{"status": "ok"}`

Commands (from `backend/`):
- `uv run pytest` - tests
- `uv run uvicorn app.main:app --reload` - local dev server on 8000

In Docker the app runs from `/app` with the venv at `/app/.venv`; data lives in `/app/data` (volume).
