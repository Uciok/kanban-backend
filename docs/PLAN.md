# Project Plan

## Decisions

General
- Project root is this repo. Secrets in `.env` (git-ignored): `OPENROUTER_API_KEY`, optional `OPENROUTER_FALLBACK_MODELS`, optional `SESSION_SECRET`
- Git: GitHub repo `Uciok/kanban-backend`, branch `main` (local branch `kanban-backend` tracks it). Commit messages start with "Kanban with backend:"

Runtime
- One Docker container `pm-app` on port 8000, published on 127.0.0.1 only. Multi-stage Dockerfile: Node builds the Next static export (`frontend/out`), copied to `/app/static` in the Python (uv) image. FastAPI serves the API under `/api` and the static files at `/` (mounted last so API routes win). `backend/static/` is not in git
- Data in the `pm-data` Docker volume at `/app/data`; `stop.sh` keeps it

Auth
- Hardcoded `user` / `password`, checked by the backend. Session in a signed cookie (Starlette `SessionMiddleware`). All `/api` routes except health and login require it (`Depends(current_user)`)
- `SESSION_SECRET` from env (set in `.env`), so sessions survive restarts. If unset, a random secret is used per start

Database
- SQLite at `data/app.db` (`DB_PATH` overrides), created with its tables on startup. Each user's board stored as one JSON blob in the frontend's `BoardData` shape. Details in `docs/DATABASE.md`
- Default board for new users lives in `backend/app/default_board.json` (single source; the frontend test fixture `src/test/board.ts` mirrors it)

Board saving
- The frontend saves the full board (`PUT /api/board`) after every change; column renames save on blur, not per keystroke
- Saves run one at a time in order (queued in `api.ts`), so an older board never overwrites a newer one; a chat message waits for pending saves. A save rejected with 401 (session ended) returns to the login form; other failed saves are not retried or shown (MVP)

AI
- OpenRouter via the `openai` SDK, model `openai/gpt-oss-120b`, then `OPENROUTER_FALLBACK_MODELS` in order as OpenRouter's `models` fallback list
- Chat uses strict structured outputs: `{ reply, board | null }`, `board` being the full updated board with cards as a list (strict schemas do not allow free-form maps); the backend converts it back. `provider.require_parameters` limits routing (fallbacks included) to providers that support structured outputs
- AI may only change cards. The backend rejects updates that change column ids, titles or order, or where a card is not in exactly one column (502, board unchanged)
- The system prompt asks for plain-text replies (no Markdown, since the app shows plain text) and to refer to cards by title, not id
- OpenRouter client: 60s timeout, 1 retry. Only the last 20 history messages are sent to the model
- Chat history lives in the browser (`sessionStorage`, so it survives a reload and is cleared on logout) and is sent with each request; only `user` and `assistant` roles are accepted
- Chat sidebar: closed by default, plain-text replies, board locked while the AI is answering, no clear-chat button. It is 340px wide and fixed on the right; on wide screens (`lg`) the board makes room for it (right padding) instead of being covered, so the columns get narrower while it is open. On an AI error the message goes back into the input and is not added to the history

Testing
- Backend: pytest with `TestClient`, a temp database per test, AI always mocked
- Frontend unit: Vitest + Testing Library; `src/test/fakeBackend.ts` stubs `fetch` with an in-memory API
- E2E: Playwright against the running container (`localhost:8000`). Tests share the real database, so each resets the board first (`signInWithFreshBoard`) and they run with one worker. Running them resets your board
- Coverage: aim for 80% (backend via `pytest-cov`, frontend via `vitest --coverage`) where it comes naturally. Only write tests that check real behavior; never add tests just to raise the number. Falling short of 80% is fine

Mobile first
- Phones: compact header (title, AI chat, Log out); description, Focus box and column chips only on `lg`. Columns scroll sideways, one per screen (85% width, scroll snap; two per screen from `sm`); five side by side from `lg`
- Drag and drop: `MouseSensor` (6px) for mouse, `TouchSensor` (press and hold 200ms) for touch so a normal swipe still scrolls; dragging to the edge auto-scrolls to the next column. Cards disable text selection and the iOS long-press callout
- Chat is full screen on phones, a 340px panel from `sm`
- Inputs use 16px text on phones (`text-base sm:text-sm`) so iOS does not zoom in on focus; card buttons have larger tap targets below `lg`

Frontend details worth knowing
- Cards can be edited inline (Edit button). While editing, the card does not get dnd-kit's drag attributes, otherwise its `aria-disabled` disables the inputs
- Cards have `role="button"` from dnd-kit with the child button labels in their accessible name, so tests match buttons by exact name. Next.js adds a hidden route announcer with `role="alert"`, so tests do not select by that role

## Layout

```
Dockerfile, .dockerignore   multi-stage: node builds frontend, python (uv) runs backend
README.md
backend/
  pyproject.toml, uv.lock
  app/main.py               FastAPI app, routes, static mount
  app/db.py                 SQLite access
  app/models.py             Pydantic Board / Column / Card
  app/ai.py                 OpenRouter calls, chat structured output, update validation
  app/default_board.json    board for new users
  tests/
frontend/                   Next.js (static export); see frontend/AGENTS.md
  src/lib/api.ts, auth.ts   API calls
  tests/                    Playwright e2e
scripts/
  start.sh, stop.sh         Mac / Linux
  start.ps1, stop.ps1       Windows
docs/
  PLAN.md, DATABASE.md
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
- [x] User verifies sign in / log out at localhost:8000

Success: board is only reachable after login; all tests pass.

## Part 5: Database modeling

- [x] Write `docs/DATABASE.md` with schema and approach:
  - `users (id INTEGER PK, username TEXT UNIQUE, created_at)`
  - `boards (id INTEGER PK, user_id INTEGER UNIQUE FK, data TEXT JSON, updated_at)`
  - `data` holds `BoardData` JSON; new users get the default board (`backend/app/default_board.json`, formerly the frontend's `initialData`)
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
- [x] Board loads from the API after login (renders nothing until loaded; no spinner)
- [x] Every change (move, add, edit, delete) saves the full board; column rename saves on blur
- [x] Remove `initialData` from the frontend (default board now comes from the backend)
- [x] Unit tests with `fetch` mocked: loads board, saves after each kind of change
- [x] E2E: each change persists across reload and logout (tests reset the board first and run one at a time)
- [x] User verifies: changes survive logout and a container restart (`stop.sh` + `start.sh`)

Success: the board is fully persistent; all tests pass.

## Part 8: AI connectivity

- [x] Add `openai` SDK; `app/ai.py` client with OpenRouter base URL, key from `OPENROUTER_API_KEY`, model `openai/gpt-oss-120b`
- [x] Optional fallbacks from `OPENROUTER_FALLBACK_MODELS` (comma-separated), sent as OpenRouter's `models` list after the main model
- [x] `POST /api/ai/test` (signed in) sends "What is 2+2?" and returns the answer
- [x] Backend test with the client mocked
- [x] Manual check against the real API, answer contains 4

Success: real call returns a correct answer from inside the container.

## Part 9: AI with the Kanban board

- [x] `POST /api/chat` with `{ message, history: [{ role, content }] }`
- [x] System prompt explains the board format and the rules (cards only; keep column ids, titles and order)
- [x] Send current board JSON + history + message; request structured output `{ reply: string, board: BoardData | null }`
- [x] If `board` is returned: validate it, check columns are unchanged and every card is in exactly one column (the same check runs on every `Board`, so `PUT /api/board` enforces it too), save it. Return `{ reply, board }`; invalid updates return 502 and the board is not changed
- [x] The AI sends cards as a list (strict structured outputs do not allow free-form maps); the backend converts it to the `cards` map
- [x] Requests set OpenRouter `provider.require_parameters` so only providers that support structured outputs are used
- [x] Tests (AI mocked): reply only leaves board unchanged; board update is saved; update that changes columns is rejected and board stays as it was; invalid model output returns a clear error; history is passed through
- [x] Manual check with the real model: create, edit and move cards via chat (structured output confirmed through OpenRouter)

Success: the real model can create, edit and move one or more cards; all tests pass.

Risk: not every OpenRouter provider (or fallback model) supports structured outputs. Mitigated with `provider.require_parameters`; confirmed working with the real model.

## Part 10: AI chat sidebar

- [x] Sidebar on the right, closed by default, opened from a header button and closable; message list, input and send button, in the project color scheme
- [x] Replies shown as plain text (line breaks kept, no Markdown rendering)
- [x] History kept in `sessionStorage`, sent with each message: survives a reload, cleared on logout
- [x] While waiting for the AI: loading state, Send disabled and the board locked (`inert`); error message on failure
- [x] When the response includes a board, update the board on screen right away
- [x] Unit tests (fetch mocked): send message, show reply, history sent, board refreshes when the AI returns a board, board locked while waiting, error shown, history survives a reload and is cleared on logout
- [x] E2E with the AI mocked at the network level (Playwright route): chat flow and board refresh
- [ ] Manual check with the real model

Success: user can chat with the AI and see board changes appear without reloading; all tests pass.

## Part 11: Mobile first

- [x] Compact header and sideways-scrolling columns on phones; desktop layout unchanged
- [x] Touch drag and drop (press and hold), checked with emulated touch in Chrome
- [x] Full-screen chat on phones; 16px inputs; larger tap targets
- [x] E2E `mobile` Playwright project (Pixel 7) with `tests/mobile.spec.ts`: board on the first screen, one column per screen with sideways scroll, chat full screen with 16px input
- [ ] User checks on a real phone

Success: the app is comfortable to use on a phone; all tests pass.
