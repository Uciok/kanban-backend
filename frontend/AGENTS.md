# Frontend

Next.js 16 (App Router) + React 19 + Tailwind 4 demo of a single Kanban board. Built as a static export (`output: "export"` -> `out/`) and served by the FastAPI backend at `/` inside the Docker container. The board is loaded from and saved to the backend (`/api/board`).

## Structure

- `src/app/layout.tsx` - root layout, loads Space Grotesk (display) and Manrope (body) via `next/font/google`
- `src/app/page.tsx` - renders `App`
- `src/components/App.tsx` - checks the session via `/api/auth/me`; shows `LoginForm` when signed out, `KanbanBoard` when signed in; handles logout
- `src/components/LoginForm.tsx` - username/password form, shows an error on 401
- `src/lib/auth.ts` - `getCurrentUser`, `login`, `logout` (fetch wrappers for `/api/auth/*`)
- `src/app/globals.css` - Tailwind import and the color scheme as CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`)
- `src/lib/kanban.ts` - types (`Card`, `Column`, `BoardData`), `moveCard` (pure reorder/move logic), `createId`
- `src/lib/api.ts` - `getBoard`, `saveBoard`
- `src/components/KanbanBoard.tsx` - loads the board on mount and saves the full board after every change (column renames save on blur); Log out button in the header (`onLogout` prop); drag and drop via `@dnd-kit` (`DndContext`, `DragOverlay`); handlers for rename column, add, edit, delete and move card
- `src/components/KanbanColumn.tsx` - droppable column, editable title input, sortable card list, `NewCardForm`
- `src/components/KanbanCard.tsx` - sortable card with Edit (inline title/details form) and Remove buttons. While editing, drag attributes are not applied (otherwise dnd-kit's `aria-disabled` disables the inputs)
- `src/components/KanbanCardPreview.tsx` - card shown in the drag overlay
- `src/components/NewCardForm.tsx` - toggleable add-card form (title required, details optional)

## Data shape

```ts
BoardData = { columns: { id, title, cardIds[] }[], cards: Record<id, { id, title, details }> }
```

Column order is the array order; card order is `cardIds` order.

## Tests

- Unit (Vitest + Testing Library, jsdom): `src/**/*.test.ts(x)`. `src/test/fakeBackend.ts` stubs `fetch` with an in-memory backend (auth + board); `src/test/board.ts` is the default board fixture (same as `backend/app/default_board.json`). Run `npm run test:unit`; coverage with `npx vitest run --coverage`.
- E2E (Playwright, Chromium): `tests/kanban.spec.ts`, against `http://127.0.0.1:8000`. Start the container first (`scripts/start.sh`), then `npm run test:e2e`. `tests/helpers.ts` has `signIn`, `signInWithFreshBoard` (resets the stored board, since tests share the real database) and `nextSave` (wait for a save before reloading). Tests run with one worker for the same reason. Next.js adds a hidden route announcer with `role="alert"`, so don't select by that role. Cards have `role="button"` from dnd-kit and their accessible name includes the child button labels, so match buttons with exact names.
