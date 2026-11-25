# Frontend

Next.js 16 (App Router) + React 19 + Tailwind 4 demo of a single Kanban board. Built as a static export (`output: "export"` -> `out/`) and served by the FastAPI backend at `/` inside the Docker container. The board is loaded from and saved to the backend (`/api/board`).

## Structure

- `src/app/layout.tsx` - root layout, loads Space Grotesk (display) and Manrope (body) via `next/font/google`
- `src/app/page.tsx` - renders `App`
- `src/components/App.tsx` - checks the session via `/api/auth/me`; shows `LoginForm` when signed out, `KanbanBoard` when signed in; handles logout (clears the chat history first, so a quick reload cannot skip it)
- `src/components/LoginForm.tsx` - username/password form, shows an error on 401
- `src/lib/auth.ts` - `getCurrentUser`, `login`, `logout` (fetch wrappers for `/api/auth/*`)
- `src/app/globals.css` - Tailwind import and the color scheme as CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`)
- `src/lib/kanban.ts` - types (`Card`, `Column`, `BoardData`), `moveCard` (pure reorder/move logic), `createId`
- `src/lib/api.ts` - `getBoard`, `saveBoard` (saves run one at a time in order; `savesDone` resolves when all have finished; returns false on 401; `KanbanBoard` then calls `onLogout` to go back to sign in)
- `src/lib/chat.ts` - `sendChat` (waits for pending board saves, then `POST /api/chat`; throws with the backend's `detail` on error, or a generic message if the error body is not JSON) and the chat history in `sessionStorage` (`loadHistory`, `saveHistory`, `clearHistory`)
- `src/components/ChatSidebar.tsx` - AI chat panel (340px) fixed on the right; the board adds matching right padding on `lg` screens while it is open; hidden with the `hidden` attribute when closed (stays mounted). Plain-text messages; Enter sends, Shift+Enter adds a line. On error the message goes back into the input. Reports busy state and AI board updates to `KanbanBoard`
- `src/components/KanbanBoard.tsx` - loads the board on mount and saves the full board after every change (column renames save on blur); AI chat and Log out buttons in the header (`onLogout` prop); locks the board (`inert`) while the AI is answering and replaces it with the AI's board (already saved by the backend); drag and drop via `@dnd-kit` (`DndContext`, `DragOverlay`); handlers for rename column, add, edit, delete and move card
- `src/components/KanbanColumn.tsx` - droppable column (scroll-snap item on phones), editable title input, sortable card list, `NewCardForm`
- `src/components/KanbanCard.tsx` - sortable card with Edit (inline title/details form) and Remove buttons. While editing, drag attributes are not applied (otherwise dnd-kit's `aria-disabled` disables the inputs)
- `src/components/KanbanCardPreview.tsx` - card shown in the drag overlay
- `src/components/NewCardForm.tsx` - toggleable add-card form (title required, details optional)

## Mobile first

Phones get a compact header and columns that scroll sideways one per screen; `lg` shows the full header and five columns. Drag uses `MouseSensor` plus `TouchSensor` (press and hold 200ms). Chat is full screen below `sm`. Inputs are 16px below `sm` to stop iOS zoom. See "Mobile first" in `docs/PLAN.md`.

## Data shape

```ts
BoardData = { columns: { id, title, cardIds[] }[], cards: Record<id, { id, title, details }> }
```

Column order is the array order; card order is `cardIds` order.

## Tests

- Unit (Vitest + Testing Library, jsdom): `src/**/*.test.ts(x)`. `src/test/fakeBackend.ts` stubs `fetch` with an in-memory backend (auth, board, and a configurable `chat` handler); `src/test/board.ts` is the default board fixture (same as `backend/app/default_board.json`). Run `npm run test:unit`; coverage with `npx vitest run --coverage`.
- E2E (Playwright): `chromium` (desktop) project for all specs except `tests/mobile.spec.ts`, which runs in the `mobile` project (Pixel 7). `tests/kanban.spec.ts`, against `http://127.0.0.1:8000`. `tests/chat.spec.ts` mocks `/api/chat` with `page.route`, so it never calls OpenRouter. Start the container first (`scripts/start.sh`), then `npm run test:e2e`. `tests/helpers.ts` has `signIn`, `signInWithFreshBoard` (resets the stored board, since tests share the real database) and `nextSave` (wait for a save before reloading). Tests run with one worker for the same reason. Next.js adds a hidden route announcer with `role="alert"`, so don't select by that role. Cards have `role="button"` from dnd-kit and their accessible name includes the child button labels, so match buttons with exact names.
