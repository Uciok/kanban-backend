# Frontend

Next.js 16 (App Router) + React 19 + Tailwind 4 demo of a single Kanban board. Built as a static export (`output: "export"` -> `out/`) and served by the FastAPI backend at `/` inside the Docker container. Boards are loaded from and saved to the backend (`/api/boards/{id}`).

## Structure

- `src/app/layout.tsx` - root layout, loads Space Grotesk (display) and Manrope (body) via `next/font/google`
- `src/app/page.tsx` - renders `App`
- `src/components/App.tsx` - checks the session via `/api/auth/me`; shows `LoginForm` when signed out, `Workspace` when signed in; handles logout and account deletion (clears the chat history first, so a quick reload cannot skip it)
- `src/components/Workspace.tsx` - loads the user's boards, opens the last used one (`localStorage` `pm-current-board`, falls back to the first), renders `KanbanBoard` (keyed by board id) with `BoardBar` as its toolbar, and the `AccountPanel`
- `src/components/BoardBar.tsx` - board picker (`select`), New board, Rename, Delete (inline confirm; disabled for the only board), Account button
- `src/components/AccountPanel.tsx` - modal dialog: change password, delete account (both need the password)
- `src/components/Dialog.tsx` - shared modal shell (overlay, header, Close) used by `AccountPanel` and `ActivityPanel`
- `src/lib/styles.ts` - shared Tailwind class strings (`inputClass`, `primaryButtonClass`, `secondaryButtonClass`, `messageClass`)
- `src/components/LoginForm.tsx` - sign in form with a toggle to create an account; shows the backend's error
- `src/lib/auth.ts` - `getCurrentUser`, `login`, `register`, `logout`, `changePassword`, `deleteAccount` (fetch wrappers for `/api/auth/*`; the last three return an error message or null)
- `src/app/globals.css` - Tailwind import and the color scheme as CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`)
- `src/lib/kanban.ts` - types (`Card`, `Column`, `BoardData`, `Priority`, `CardFilter`), `moveCard` (pure reorder/move logic), `createId`, `PRIORITIES` / `PRIORITY_LABELS`, and card helpers: `todayString`, `isOverdue`, `parseLabels` (comma text to a clean list within the backend limits), `matchesFilter` / `isFilterActive`, `addDays`, `boardStats`, `relativeTime`
- `src/lib/api.ts` - `listBoards`, `createBoard`, `renameBoard`, `deleteBoard`, `getBoard`, `saveBoard`, `getActivity`, `errorMessage`, `jsonRequest` (shared by `auth.ts` and `chat.ts`) (saves run one at a time in order; `savesDone` resolves when all have finished; returns false on 401; `KanbanBoard` then calls `onLogout` to go back to sign in)
- `src/lib/chat.ts` - `sendChat` (waits for pending board saves, then `POST /api/boards/{id}/chat`; throws with the backend's `detail` on error, or a generic message if the error body is not JSON) and the chat history in `sessionStorage`, one key per board `pm-chat-history-<id>` (`loadHistory`, `saveHistory`, `clearHistory` removes all)
- `src/components/ChatSidebar.tsx` - AI chat panel (340px) fixed on the right; the board adds matching right padding on `lg` screens while it is open; hidden with the `hidden` attribute when closed (stays mounted). Plain-text messages; Enter sends, Shift+Enter adds a line. On error the message goes back into the input. Reports busy state and AI board updates to `KanbanBoard`
- `src/components/KanbanBoard.tsx` - takes `boardId` and an optional `toolbar`; loads the board on mount and saves the full board after every change (column renames save on blur); AI chat and Log out buttons in the header (`onLogout` prop); locks the board (`inert`) while the AI is answering and replaces it with the AI's board (already saved by the backend); drag and drop via `@dnd-kit` (`DndContext`, `DragOverlay`); handlers for rename column (a blank title is restored on blur), add / move / delete column, add, edit, delete and move card
- `src/components/KanbanColumn.tsx` - droppable column (scroll-snap item on phones), editable title input, Move left / right and Delete buttons (delete only when the column has no cards, hidden ones included, and is not the last), sortable card list, `NewCardForm`
- `src/components/NewColumnForm.tsx` - Add column button and inline form, shown in the `FilterBar` actions slot until the board has 12 columns
- `src/components/KanbanCard.tsx` - sortable card with Edit (inline form: title, details, priority, due date, labels) and Remove buttons. `CardMeta` (also used by the drag preview) shows the priority badge, due date ("Overdue" in red when past) and `#labels`. While editing, drag attributes are not applied (otherwise dnd-kit's `aria-disabled` disables the inputs)
- `src/components/Checklist.tsx` - `ChecklistEditor` (in the card edit form: tick, rename, remove, add; Enter adds an item instead of submitting; blank items are dropped on save; max 20) and `ChecklistView` (on the card: "Checklist 2/5" with a progress bar, expands to tick items, which saves at once)
- `src/components/KanbanCardPreview.tsx` - card shown in the drag overlay
- `src/components/ActivityPanel.tsx` - modal dialog opened from the Activity button in the board header; loads `/api/boards/{id}/activity` each time it opens and shows each change with user and relative time (`relativeTime` in `kanban.ts`)
- `src/components/BoardSummary.tsx` - header totals for the open board from `boardStats` (cards, overdue in red when > 0, due this week, high priority); counts every card, not only filtered ones
- `src/components/FilterBar.tsx` - search (title, details, labels) and priority filter above the columns; shows "Showing X of Y cards" and Clear filters when active. `KanbanBoard` renders only matching cards; hidden cards stay in the board and are saved untouched
- `src/components/NewCardForm.tsx` - toggleable add-card form (title required, details optional)

## Mobile first

Phones get a compact header (title and buttons on one row, short "New" label for New board) and columns that scroll sideways one per screen; `lg` shows the full header and columns at least 240px wide, scrolling sideways when they do not fit. `tests/mobile.spec.ts` checks the first column starts in the top half of a Pixel 7 screen, so keep phone controls compact. On desktop, keep the header compact so cards start high on a 1280x720 screen; the drag tests scroll the card into view before dragging. Drag uses `MouseSensor` plus `TouchSensor` (press and hold 200ms). Chat is full screen below `sm`. Inputs are 16px below `sm` to stop iOS zoom. See "Mobile first" in `docs/PLAN.md`.

## Data shape

```ts
BoardData = { columns: { id, title, cardIds[] }[], cards: Record<id, { id, title, details, priority, dueDate, labels, checklist }> }
// priority: "low" | "medium" | "high" | null; dueDate: "YYYY-MM-DD" | null; labels: string[]; checklist: { id, text, done }[]
```

Column order is the array order; card order is `cardIds` order.

## Tests

- Unit (Vitest + Testing Library, jsdom): `src/**/*.test.ts(x)`. `src/test/fakeBackend.ts` stubs `fetch` with an in-memory backend (users with passwords, multiple boards per user, a configurable `chat` handler; the demo user starts with board 1 "My board"); `src/test/board.ts` is the default board fixture (same as `backend/app/default_board.json`). Run `npm run test:unit`; coverage with `npx vitest run --coverage`.
- Unit tests: `src/test/renderBoard.tsx` renders board 1 against the fake backend; `src/test/setup.ts` unstubs globals after every test.
- E2E (Playwright): `chromium` (desktop) project for all specs except `tests/mobile.spec.ts`, which runs in the `mobile` project (Pixel 7). `tests/kanban.spec.ts`, against `http://127.0.0.1:8000`. `tests/chat.spec.ts` mocks `/api/boards/*/chat` with `page.route`, so it never calls OpenRouter. Start the container first (`scripts/start.sh`), then `npm run test:e2e`. `tests/accounts.spec.ts` and `tests/boards.spec.ts` cover sign up, password change, account deletion, user isolation and board create/switch/rename/delete. `tests/helpers.ts` has `signIn`, `signInWithFreshBoard` (resets the demo user to one default board "My board", since tests share the real database), `uniqueUsername` (for accounts created by tests), `signUp`, `expectBoard`, `dragCardOver` (scroll, press and move; the caller releases the mouse) and `nextSave` (wait for a save before reloading). Tests run with one worker for the same reason. Next.js adds a hidden route announcer with `role="alert"`, so don't select by that role. Cards have `role="button"` from dnd-kit and their accessible name includes the child button labels, so match buttons with exact names.
