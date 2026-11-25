# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Project requirements, tech decisions, color scheme and coding standards are in `AGENTS.md` (imported below). Read `docs/PLAN.md` before starting work: it holds the decisions log and the part-by-part checklist. Each area has its own detailed notes that are kept up to date: `backend/AGENTS.md`, `frontend/AGENTS.md`, `scripts/AGENTS.md`, `docs/DATABASE.md`. Update the relevant one when you change structure, routes or behavior.

@AGENTS.md

## Commands

App (Docker, port 8000, needs `.env` with `OPENROUTER_API_KEY`):
- `./scripts/start.sh` / `./scripts/stop.sh` - build and run / stop the `pm-app` container (data kept in the `pm-data` volume)

Backend (from `backend/`, uv, Python 3.13):
- `uv run pytest` - all tests (`--cov=app` for coverage)
- `uv run pytest tests/test_chat.py::test_name` - single test
- `uv run uvicorn app.main:app --reload` - dev server on 8000 (serves the frontend only if `frontend/out` is copied to `backend/static`)

Frontend (from `frontend/`):
- `npm run test:unit` - Vitest; single file: `npx vitest run src/lib/kanban.test.ts`, single test: add `-t "name"`
- `npm run test:e2e` - Playwright against the running container; single spec: `npx playwright test tests/kanban.spec.ts`. Resets the stored board
- `npm run lint`, `npm run build` (static export to `out/`)

## Architecture

- One container: a multi-stage Dockerfile builds the Next.js static export, then copies it to `/app/static` in the Python image. FastAPI (`backend/app/main.py`) serves `/api/*` and mounts the static files at `/` last so API routes win. There is no Next server at runtime, so the frontend is client-only and talks to `/api` with same-origin cookies.
- Auth: user accounts in SQLite with scrypt password hashes (demo account `user` / `password` seeded on startup). The session (Starlette signed cookie) holds `user_id`; protected routes use the `UserId` dependency, and every board query is scoped to that user (another user's board is 404).
- Data: users have many boards; each board's contents are one JSON blob in SQLite (`boards.data`) in exactly the frontend's `BoardData` shape (`columns[]` with ordered `cardIds`, `cards` map). Schema changes go through `PRAGMA user_version` migrations in `db.init_db` (see `docs/DATABASE.md`). The frontend saves the whole board with `PUT /api/boards/{id}` after every change, one save at a time. The Pydantic `Board` in `backend/app/models.py` and the TS types in `frontend/src/lib/kanban.ts` must stay in sync.
- Default board: `backend/app/default_board.json` is the source of truth; `frontend/src/test/board.ts` mirrors it for tests.
- AI chat: `POST /api/boards/{id}/chat` sends board + history + message to OpenRouter (`backend/app/ai.py`) using strict structured output `{reply, board | null}`. Strict schemas forbid free-form maps and defaults, so the AI returns `AICard`s (all fields required) as a list and the backend validates them into the `Card` map. `apply_update` rejects any change to columns or any card not in exactly one column (502, board unchanged). Chat history lives only in the browser (`sessionStorage`, per board) and is cleared on logout.

## Testing notes

- Backend tests use a temp DB per test (autouse fixture in `conftest.py`; `signed_in`, `board_id`, `other_client` fixtures) and always mock the AI (`ai.chat`, `ai.ask` or `ai.client`). Never call OpenRouter in tests.
- Frontend unit tests stub `fetch` with the in-memory backend in `src/test/fakeBackend.ts`.
- E2E tests share the real database, so they run with one worker and start with `signInWithFreshBoard` (resets the demo user to one board); tests that create accounts use `uniqueUsername`. `tests/chat.spec.ts` mocks `/api/boards/*/chat` via `page.route`. Don't select by `role="alert"` (Next's route announcer); match card buttons by exact name.
- Aim for about 80% coverage only where it comes naturally; never add tests just to raise the number.

## Git

Remote is `Uciok/kanban-backend` over SSH. The local branch `kanban-backend` pushes to `main` (`push.default=upstream`, so plain `git push` works). Commit messages start with "Kanban with backend:".
