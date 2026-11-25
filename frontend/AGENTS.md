# Frontend

Next.js 16 (App Router) + React 19 + Tailwind 4 demo of a single Kanban board. Currently frontend-only: all state lives in React memory and resets on reload.

## Structure

- `src/app/layout.tsx` - root layout, loads Space Grotesk (display) and Manrope (body) via `next/font/google`
- `src/app/page.tsx` - renders `KanbanBoard`
- `src/app/globals.css` - Tailwind import and the color scheme as CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`)
- `src/lib/kanban.ts` - types (`Card`, `Column`, `BoardData`), `initialData` (5 columns, 8 cards), `moveCard` (pure reorder/move logic), `createId`
- `src/components/KanbanBoard.tsx` - owns board state; drag and drop via `@dnd-kit` (`DndContext`, `DragOverlay`); handlers for rename column, add card, delete card, move card
- `src/components/KanbanColumn.tsx` - droppable column, editable title input, sortable card list, `NewCardForm`
- `src/components/KanbanCard.tsx` - sortable card with Remove button
- `src/components/KanbanCardPreview.tsx` - card shown in the drag overlay
- `src/components/NewCardForm.tsx` - toggleable add-card form (title required, details optional)

## Data shape

```ts
BoardData = { columns: { id, title, cardIds[] }[], cards: Record<id, { id, title, details }> }
```

Column order is the array order; card order is `cardIds` order.

## Tests

- Unit (Vitest + Testing Library, jsdom): `src/lib/kanban.test.ts`, `src/components/KanbanBoard.test.tsx`. Run `npm run test:unit`.
- E2E (Playwright, Chromium): `tests/kanban.spec.ts`. Currently starts the Next dev server on port 3000. Run `npm run test:e2e`.

## Known gaps

- Cards cannot be edited yet (only added, removed, moved)
- No persistence, no auth, no API calls
- `next.config.ts` is default (no static export yet)
