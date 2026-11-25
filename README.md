# Kanban with backend

A single-board Kanban app with sign in and a persistent board. Next.js frontend, FastAPI backend, SQLite, all in one Docker container. An AI chat sidebar that can edit the board is in progress (see `docs/PLAN.md`).

## Run

Requires Docker. Create `.env` in the project root:

```
OPENROUTER_API_KEY=your-key
```

Then:

```bash
./scripts/start.sh    # Mac / Linux (Windows: scripts/start.ps1)
./scripts/stop.sh     # Windows: scripts/stop.ps1
```

Open http://localhost:8000 and sign in with `user` / `password`. Board data is kept in the `pm-data` Docker volume.

## Tests

```bash
cd backend && uv run pytest
cd frontend && npm install && npm run test:unit
cd frontend && npm run test:e2e    # needs the container running; resets the board
```

## Structure

- `frontend/` - Next.js app, built as static files
- `backend/` - FastAPI API and static file server, SQLite database
- `scripts/` - start and stop scripts
- `docs/` - plan and database notes
