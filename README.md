# Kanban with backend

A Kanban project management app: user accounts, multiple boards per user, persistent boards. Next.js frontend, FastAPI backend, SQLite, all in one Docker container. An AI chat sidebar can create, edit and move cards. Works on phones too.

## Run

Requires Docker. Create `.env` in the project root:

```
OPENROUTER_API_KEY=your-key
SESSION_SECRET=any-long-random-string
```

`SESSION_SECRET` keeps you signed in across restarts (e.g. `openssl rand -hex 32`).

Then:

```bash
./scripts/start.sh    # Mac / Linux (Windows: scripts/start.ps1)
./scripts/stop.sh     # Windows: scripts/stop.ps1
```

Open http://localhost:8000 (only reachable from this machine). Create an account, or sign in with the demo account `user` / `password`. Board data is kept in the `pm-data` Docker volume.

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
