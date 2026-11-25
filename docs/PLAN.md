# Project Plan

## Decisions

- Project root: this repo. Secrets in `.env` (git-ignored): `OPENROUTER_API_KEY`
- One Docker container on port 8000. FastAPI serves the API under `/api` and the static Next export at `/`
- Auth: hardcoded `user` / `password`, checked by the backend, session kept in a signed cookie (Starlette `SessionMiddleware`). All `/api` routes except login require it
- Database: SQLite at `data/app.db` (Docker volume), created on startup if missing. Each user's board stored as one JSON blob in the `BoardData` shape the frontend already uses
- AI: OpenRouter via the `openai` SDK, model `openai/gpt-oss-120b`. Structured output returns `{ reply, board | null }`, where `board` is the full updated board. AI may only change cards; column ids, titles and order must stay the same
- Chat history lives in the browser and is sent with each request
- Tests: pytest for backend (AI mocked), Vitest for frontend units, Playwright e2e against the running container
- Coverage: aim for 80% (backend via `pytest-cov`, frontend via `vitest --coverage`) where it comes naturally. Only write tests that check real behavior; never add tests just to raise the number. Falling short of 80% is fine

## Target layout

```
Dockerfile              multi-stage: node builds frontend, python (uv) runs backend
backend/
  pyproject.toml, uv.lock
  app/main.py           FastAPI app, routes, static mount
  app/db.py             SQLite access
  app/ai.py             OpenRouter calls
  tests/
frontend/               Next.js (static export)
scripts/
  start.sh, stop.sh     Mac / Linux
  start.ps1, stop.ps1   Windows
docs/
```

---

## Part 1: Plan

- [x] Enrich this plan with substeps, tests and success criteria
- [x] Write `frontend/AGENTS.md` describing the existing code
- [x] User reviews and approves the plan

Success: user sign-off.

## Part 2: Scaffolding

- [x] `backend/` with uv project (`fastapi`, `uvicorn`), `app/main.py`
- [x] `GET /api/health` returns `{"status": "ok"}`
- [x] Temporary `static/index.html` hello world that calls `/api/health` and shows the result
- [x] `Dockerfile` (python slim + uv), runs uvicorn on 8000
- [x] `scripts/start.sh` / `start.ps1`: build image, run container `pm-app` with `--env-file .env`, port 8000, volume for `data/`
- [x] `scripts/stop.sh` / `stop.ps1`: stop and remove the container
- [x] pytest set up with one test for `/api/health`
- [x] Update `backend/AGENTS.md` and `scripts/AGENTS.md`
- [x] User verifies the container with the start/stop scripts

Tests: pytest health check. Manual: start script, open `http://localhost:8000`, see hello world plus API response; stop script cleans up.

Success: container starts and stops with the scripts on Mac/Linux (Windows scripts reviewed), page and API both respond.

## Part 3: Add in Frontend

- [x] `next.config.ts`: `output: "export"`
- [x] Dockerfile: node stage builds `frontend/out`, copied into the python image; FastAPI mounts it at `/` (after API routes). Remove the hello world page
- [x] Add card editing (title and details) - required by the business requirements, missing in the demo
- [x] Playwright config: `baseURL` `http://127.0.0.1:8000`, no dev server (expects container running)
- [x] Unit tests: card editing, existing tests still pass
- [x] E2E: board loads from the container, add, edit, delete, move card, rename column
- [x] User verifies the board at localhost:8000 via the start script and runs `npm run test:e2e`

Success: `localhost:8000` shows the Kanban board from the container; all unit and e2e tests pass.

## Part 4: Fake sign in

- [x] Backend: `POST /api/auth/login` (checks `user` / `password`, sets session), `POST /api/auth/logout`, `GET /api/auth/me`
- [x] Session secret from env (`SESSION_SECRET`), generated at startup if unset
- [x] Frontend: on load call `/api/auth/me`; show login form if not signed in, board if signed in. Logout button in the header
- [x] Backend tests: valid login, invalid login (401), me with and without session, logout clears session
- [x] Unit tests: login form renders, error on bad credentials, logout
- [x] E2E: must log in to see the board; bad credentials show error; logout returns to login; session survives reload
- [ ] User verifies sign in / log out at localhost:8000

Success: board is only reachable after login; all tests pass.

## Part 5: Database modeling

- [x] Write `docs/DATABASE.md` with schema and approach:
  - `users (id INTEGER PK, username TEXT UNIQUE, created_at)`
  - `boards (id INTEGER PK, user_id INTEGER UNIQUE FK, data TEXT JSON, updated_at)`
  - `data` holds `BoardData` JSON; new users get the default board (the current `initialData`)
  - `user` is seeded on startup; passwords stay hardcoded for the MVP
- [x] Example board JSON in the doc
- [x] User sign-off

Success: user approves the schema.

## Part 6: Backend

- [x] `app/db.py`: create db and tables if missing, seed `user`, get board (create default if none), save board
- [x] Pydantic models for `BoardData`
- [x] `GET /api/board` returns the signed-in user's board
- [x] `PUT /api/board` validates and saves the full board
- [x] DB path configurable (`DB_PATH`) so tests use a temp file
- [x] Tests: db created when missing; default board on first read; save then read round-trips; invalid payload rejected (422); unauthenticated requests rejected (401); boards are isolated per user

Success: all backend tests pass; data survives container restart (volume).

## Part 7: Frontend + Backend

- [x] `src/lib/api.ts`: `getBoard`, `saveBoard`
- [x] Board loads from the API after login (loading state while fetching)
- [x] Every change (move, add, edit, delete) saves the full board; column rename saves on blur
- [x] Remove `initialData` from the frontend (default board now comes from the backend)
- [x] Unit tests with `fetch` mocked: loads board, saves after each kind of change
- [x] E2E: each change persists across reload and logout (tests reset the board first and run one at a time)
- [ ] User verifies: changes survive logout and a container restart (`stop.sh` + `start.sh`)

Success: the board is fully persistent; all tests pass.

## Part 8: AI connectivity

- [ ] Add `openai` SDK; `app/ai.py` client with OpenRouter base URL, key from `OPENROUTER_API_KEY`, model `openai/gpt-oss-120b`
- [ ] `POST /api/ai/test` (signed in) sends "What is 2+2?" and returns the answer
- [ ] Backend test with the client mocked
- [ ] Manual check against the real API, answer contains 4

Success: real call returns a correct answer from inside the container.

## Part 9: AI with the Kanban board

- [ ] `POST /api/chat` with `{ message, history: [{ role, content }] }`
- [ ] System prompt explains the board format and the rules (cards only; keep column ids, titles and order)
- [ ] Send current board JSON + history + message; request structured output `{ reply: string, board: BoardData | null }`
- [ ] If `board` is returned: validate it, check columns are unchanged, save it. Return `{ reply, board }`
- [ ] Tests (AI mocked): reply only leaves board unchanged; board update is saved; update that changes columns is rejected and board stays as it was; invalid model output returns a clear error; history is passed through
- [ ] Manual check with the real model: create, edit and move cards via chat

Success: the real model can create, edit and move one or more cards; all tests pass.

Risk: not every OpenRouter provider for `gpt-oss-120b` supports structured outputs. If needed, set provider routing to require it (`require_parameters`). Confirm with evidence in Part 8/9.

## Part 10: AI chat sidebar

- [ ] Collapsible sidebar on the right with message list, input and send button, in the project color scheme
- [ ] History kept in React state, sent with each message
- [ ] Loading state while waiting; error message on failure
- [ ] When the response includes a board, update the board on screen right away
- [ ] Unit tests (fetch mocked): send message, show reply, board refreshes when the AI returns a board, error shown
- [ ] E2E with the AI mocked at the network level (Playwright route): chat flow and board refresh
- [ ] Manual check with the real model

Success: user can chat with the AI and see board changes appear without reloading; all tests pass.
