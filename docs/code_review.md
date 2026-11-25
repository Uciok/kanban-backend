# Code review

Date: 2026-11-25. Scope: the whole repo at commit `06d7459` (backend, frontend, Docker, scripts, tests, docs).

## Summary

The codebase is small, readable and consistent with the plan. Tests are in good shape: 27 backend tests (99% coverage), 22 frontend unit tests and 17 Playwright tests all pass; ESLint and `tsc --noEmit` are clean. The AI update path is well guarded (strict structured output, column and card checks, board saved only after validation).

The main gaps are at the edges: failures of the OpenRouter call, failed board saves and the network exposure of the container. Three issues are worth fixing before relying on the app day to day (H1-H3).

Status: H1, H2 and H3 fixed on 2026-11-25 (see the action list).

Severity: **High** = users hit it in normal use or it exposes the API key; **Medium** = real but needs a less common situation; **Low** = minor or cosmetic.

## What is good

- Clear split: `ai.py` (model calls and validation), `db.py` (storage), `main.py` (routes). Each file is short and does one thing.
- One board shape everywhere (`BoardData`), stored as one JSON document. Simple and matches how the frontend and the AI use it.
- `apply_update` rejects column changes and inconsistent cards, and the board is only saved after that check.
- Tests check behavior, not implementation details. The AI is always mocked; e2e tests reset state and run one at a time.
- Mobile layout and touch drag are handled deliberately (press-and-hold, 16px inputs, scroll snap).

## Findings

### High

**H1. Failed AI calls show a garbled error in the chat**
`backend/app/ai.py:54-83`, `backend/app/main.py:98-106`, `frontend/src/lib/chat.ts:36`

Only `ValidationError` and `LengthFinishReasonError` are turned into `AIError`. Anything else escapes as an unhandled exception, and FastAPI returns `500` with the plain text `Internal Server Error`. That includes:
- network errors, timeouts and rate limits
- a bad or expired API key
- a missing `OPENROUTER_API_KEY`, which raises `KeyError` in `client()`
- a model refusal, where `parsed` is `None` and `result.board` then raises `AttributeError`

`sendChat` then calls `response.json()` on that text, which throws a `SyntaxError`, and the user sees something like `Unexpected token 'I', "Internal S"... is not valid JSON`.

Confirmed by running `/api/chat` with `ai.chat` raising `openai.APIConnectionError`: response was `500 text/plain 'Internal Server Error'`.

Action:
- In `ai.chat`, also catch `openai.APIError` and raise `AIError("The AI service is unavailable, please try again")`. Treat `message.parsed is None` (refusal) as `AIError` too.
- In `sendChat`, check `response.ok` before parsing, and fall back to a generic message if the body is not JSON.
- Add a backend test for an API error (502 with a readable `detail`) and a unit test for a non-JSON error body.

**H2. The app is reachable from other machines on the network**
`scripts/start.sh:6`, `scripts/start.ps1:5`

`-p 8000:8000` publishes the port on all interfaces. Anyone on the same Wi-Fi can open `http://<your-ip>:8000`, sign in with the documented `user` / `password`, edit the board and use the AI chat on your OpenRouter key.

Action: publish on localhost only, `-p 127.0.0.1:8000:8000`, in both start scripts. The Playwright tests already use `127.0.0.1`.

**H3. Edits are silently lost after a container restart**
`backend/app/main.py:27-29`, `frontend/src/lib/api.ts:8-14`, `.env`

`SESSION_SECRET` is not set in `.env`, so a new random secret is generated on every start and all sessions become invalid. An open tab keeps showing the board, but every `PUT /api/board` now returns 401. `saveBoard` ignores the status, so the user keeps editing and nothing is stored.

The plan accepts "no error display for failed saves", but with the default setup this happens on every restart, not just on rare network errors.

Action:
- Add `SESSION_SECRET` to `.env` and mention it in the README (one line).
- In `saveBoard`, treat a 401 as "signed out": surface it to `App` so it returns to the login form. Leave other save errors unhandled for the MVP if preferred.

### Medium

**M1. A hung AI request can lock the board for up to half an hour**
`backend/app/ai.py:54-55`

The `openai` SDK defaults to a 600 s read timeout with 2 retries. While waiting, the board is `inert` and Send is disabled, with no way to cancel other than reloading.

Action: create the client with `timeout=60, max_retries=1`. Combined with H1, the user then gets a clear error after about a minute.

**M2. The backend accepts boards that crash the frontend**
`backend/app/models.py:16-18`, `frontend/src/components/KanbanBoard.tsx:203`

`PUT /api/board` only checks types. A board whose column lists a card id missing from `cards` is saved (confirmed: returns 200). On the next load `board.cards[cardId]` is `undefined` and rendering `KanbanCard` throws, leaving a blank page until the stored data is fixed by hand. The same goes for a card listed in two columns, or a `cards` key that does not match the card's `id`.

Action: move the consistency check into `Board` as a Pydantic `model_validator`:
- every id in `cardIds` exists in `cards`
- no card appears in two columns
- every card is in some column
- each `cards` key equals its card's `id`

`apply_update` then only needs the column check, because building the `Board` runs the rest. Add a 422 test for a dangling card id.

**M3. Chat history grows without limit**
`backend/app/main.py:36-38`, `backend/app/ai.py:67-72`

The whole session history is sent on every message, so cost grows with each turn. A long session eventually hits the model's context limit, which then fails as in H1.

Action: send only the last N messages to the model, for example 20, by slicing `history` in `ai.chat`. Keep the full history in the browser for display.

**M4. Board saves can arrive out of order**
`frontend/src/components/KanbanBoard.tsx:51-54`, `frontend/src/lib/api.ts:8`

Each change fires its own `PUT` without waiting for the previous one. Two quick changes (for example a drag and then an add) can be handled by the server in the opposite order, and the older board wins. Similarly, a chat message sent right after an edit can reach the AI before that edit is stored, and the AI's board then drops the edit.

Action: chain saves in `api.ts` so each `PUT` starts after the previous one finishes (a module-level promise, a few lines). Before sending a chat message, wait for the pending save.

### Low

**L1. No error handling on first load.**
`frontend/src/components/App.tsx:14`, `frontend/src/components/KanbanBoard.tsx:44`

If `/api/auth/me` or `/api/board` fails (server down, or a 401 between the two calls), the promise rejects or a `{detail}` object is set as the board. The result is a blank page or a render crash.

Action: in `getBoard`, check `response.ok` (same pattern as H3). A blank page when the server is down is acceptable for the MVP.

**L2. An open card edit can overwrite the AI's change to that card.**
`frontend/src/components/KanbanCard.tsx:14-39`

Edit state is copied when editing starts. If the AI changes the same card meanwhile, Save writes back the old values.

Action: none for the MVP. If it matters, close open edit forms when the AI returns a board.

**L3. Cards cannot be moved with the keyboard.**
`frontend/src/components/KanbanBoard.tsx:33-41`

Only mouse and touch sensors are registered, while the cards still get `role="button"` and a tab stop from dnd-kit. The AI chat is a workaround.

Action: add dnd-kit's `KeyboardSensor` with `sortableKeyboardCoordinates`, or note it as a known limitation.

**L4. A column can be renamed to an empty title.**
`frontend/src/components/KanbanColumn.tsx:46-50`

Action: on blur, if the title is blank, restore the previous title instead of saving.

**L5. Inconsistent empty card details.**
`frontend/src/components/KanbanBoard.tsx:94`

A new card without details stores the text "No details yet." as real data, which the AI also sees, while editing a card to empty details stores `""`.

Action: store `""` in both cases and show a placeholder only in the UI, or drop the placeholder.

**L6. A race when creating the first board.**
`backend/app/db.py:54-56`

Two simultaneous first reads for a new user both try `INSERT INTO boards` and one fails on the `UNIQUE` constraint.

Action: use `INSERT OR IGNORE` and read the row back. This is only reachable with multiple users, so it is very unlikely now.

**L7. Docker image hygiene.**
`Dockerfile:9`

`ghcr.io/astral-sh/uv:latest` is unpinned, so builds can change without any code change. The container also runs as root.

Action: pin the uv image tag. Running as a non-root user is optional for a local MVP, and the `/app/data` volume permissions would need care.

### Housekeeping

- `frontend/test-results/.last-run.json` is tracked in git but rewritten by every Playwright run. Untrack it (`git rm --cached`) and add `/test-results/` and `/playwright-report/` to `frontend/.gitignore`.
- `frontend/README.md` is the original demo README ("Kanban Studio", `npm run dev`). `npm run dev` now runs without the backend, so sign-in and saving fail. Replace it with a pointer to the root README and the unit test command, or delete it.
- `CLAUDE.md` and `docs/PLAN.md` say commit messages start with "Kanban with backend:", but recent commits do not follow it. Either drop the rule or follow it.
- Running the backend tests needs `uv` on the host; it is not installed on the current machine. Add `brew install uv` to the README prerequisites, or note how to run pytest in Docker.

## Action list

In suggested order. Each item is small.

- [x] H2: bind the container to `127.0.0.1` in `start.sh` and `start.ps1`
- [x] H3: add `SESSION_SECRET` to `.env` and the README; return to the login form when a save gets 401
- [x] H1: map OpenRouter errors and refusals to `AIError` (502); make `sendChat` handle non-JSON errors; add tests
- [ ] M1: OpenAI client `timeout=60, max_retries=1`
- [ ] M2: board consistency `model_validator` on `Board`; simplify `apply_update`; add a 422 test
- [ ] M3: send only the last 20 history messages to the model
- [ ] M4: chain board saves in `api.ts`; wait for the pending save before sending a chat message
- [ ] L1: check `response.ok` in `getBoard`
- [ ] L4: keep the previous column title when the new one is blank
- [ ] L5: stop storing "No details yet." as card data
- [ ] L7: pin the uv image tag
- [ ] Housekeeping: untrack `test-results`, fix `frontend/README.md`, settle the commit message rule, document `uv`
- [ ] Optional: L2, L3, L6
