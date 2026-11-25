"use client";

import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { ChatSidebar } from "@/components/ChatSidebar";
import { getBoard, saveBoard } from "@/lib/api";
import { ActivityPanel } from "@/components/ActivityPanel";
import { BoardSummary } from "@/components/BoardSummary";
import { FilterBar } from "@/components/FilterBar";
import { NewColumnForm } from "@/components/NewColumnForm";
import {
  EMPTY_FILTER,
  MAX_COLUMNS,
  boardStats,
  createId,
  matchesFilter,
  moveCard,
  todayString,
  type BoardData,
  type Card,
  type CardFilter,
} from "@/lib/kanban";

type KanbanBoardProps = {
  boardId: number;
  onLogout: () => void;
  // Board switcher and account controls, shown in the header
  toolbar?: ReactNode;
};

export const KanbanBoard = ({ boardId, onLogout, toolbar }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  // Board is locked while the AI is answering, so its update cannot overwrite manual edits
  const [isLocked, setIsLocked] = useState(false);
  const [filter, setFilter] = useState<CardFilter>(EMPTY_FILTER);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    // Touch: press and hold to drag, so a normal swipe still scrolls
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  );

  useEffect(() => {
    getBoard(boardId).then((detail) => setBoard(detail.board));
  }, [boardId]);

  if (!board) {
    return null;
  }

  // A save rejected with 401 means the session ended (e.g. server restart): go back to sign in
  const save = async (next: BoardData) => {
    if (!(await saveBoard(boardId, next))) {
      onLogout();
    }
  };

  const update = (next: BoardData) => {
    setBoard(next);
    save(next);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    update({
      ...board,
      columns: moveCard(board.columns, active.id as string, over.id as string),
    });
  };

  // Renames update locally on every keystroke and save on blur
  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard({
      ...board,
      columns: board.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    });
  };

  // A blank title is not saved: the column goes back to its title from before the edit
  const handleRenameDone = (columnId: string, previousTitle: string) => {
    update({
      ...board,
      columns: board.columns.map((column) =>
        column.id === columnId ? { ...column, title: column.title.trim() || previousTitle } : column
      ),
    });
  };

  const handleAddColumn = (title: string) => {
    update({
      ...board,
      columns: [...board.columns, { id: createId("col"), title, cardIds: [] }],
    });
  };

  const handleMoveColumn = (columnId: string, offset: -1 | 1) => {
    const from = board.columns.findIndex((column) => column.id === columnId);
    const columns = [...board.columns];
    const [moved] = columns.splice(from, 1);
    columns.splice(from + offset, 0, moved);
    update({ ...board, columns });
  };

  // Only empty columns can be deleted, so no cards are lost
  const handleDeleteColumn = (columnId: string) => {
    update({ ...board, columns: board.columns.filter((column) => column.id !== columnId) });
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    update({
      ...board,
      cards: {
        ...board.cards,
        [id]: { id, title, details, priority: null, dueDate: null, labels: [], checklist: [] },
      },
      columns: board.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    });
  };

  const handleEditCard = (cardId: string, changes: Omit<Card, "id">) => {
    update({
      ...board,
      cards: { ...board.cards, [cardId]: { id: cardId, ...changes } },
    });
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    update({
      ...board,
      cards: Object.fromEntries(
        Object.entries(board.cards).filter(([id]) => id !== cardId)
      ),
      columns: board.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) }
          : column
      ),
    });
  };

  const activeCard = activeCardId ? board.cards[activeCardId] : null;
  // Cards hidden by the filter stay in the board; only the shown ones are rendered
  const visibleCards = (cardIds: string[]) =>
    cardIds.map((cardId) => board.cards[cardId]).filter((card) => matchesFilter(card, filter));
  const totalCards = Object.keys(board.cards).length;
  const shownCards = board.columns.reduce((sum, column) => sum + visibleCards(column.cardIds).length, 0);

  return (
    // On wide screens the board makes room for the open chat instead of being covered
    <div className={clsx("relative overflow-hidden", isChatOpen && "lg:pr-[340px]")}>
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-4 px-4 pb-8 pt-4 lg:gap-6 lg:px-6 lg:pb-16 lg:pt-8">
        <header className="flex flex-col gap-6 rounded-3xl border border-[var(--stroke)] bg-white/80 p-4 shadow-[var(--shadow)] backdrop-blur lg:rounded-[32px] lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 lg:items-start lg:gap-6">
            <div>
              <p className="hidden text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)] lg:block">
                Project management
              </p>
              <h1 className="font-display text-xl font-semibold text-[var(--navy-dark)] lg:mt-3 lg:text-4xl">
                Kanban Studio
              </h1>
            </div>
            <div className="flex items-center gap-2 lg:items-start lg:gap-4">
              <button
                type="button"
                onClick={() => setIsChatOpen(true)}
                className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
              >
                AI chat
              </button>
              <button
                type="button"
                onClick={() => setIsActivityOpen(true)}
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
              >
                Activity
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
              >
                Log out
              </button>
            </div>
          </div>
          {toolbar}
          <BoardSummary stats={boardStats(board, todayString())} />
        </header>

        <div
          inert={isLocked}
          data-testid="board"
          className={clsx("space-y-4", isLocked && "opacity-60")}
        >
          <FilterBar
            filter={filter}
            shown={shownCards}
            total={totalCards}
            onChange={setFilter}
            actions={board.columns.length < MAX_COLUMNS && <NewColumnForm onAdd={handleAddColumn} />}
          />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Phones: one column per screen, swiped sideways. Large screens: five columns side by side */}
            <section className="-mx-4 grid snap-x snap-mandatory auto-cols-[85%] grid-flow-col gap-4 overflow-x-auto px-4 pb-2 sm:auto-cols-[45%] lg:mx-0 lg:snap-none lg:auto-cols-[minmax(240px,1fr)] lg:gap-6 lg:px-1 lg:pb-4">
              {board.columns.map((column, index) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  canMoveLeft={index > 0}
                  canMoveRight={index < board.columns.length - 1}
                  canDelete={column.cardIds.length === 0 && board.columns.length > 1}
                  onMove={handleMoveColumn}
                  onDelete={handleDeleteColumn}
                  cards={visibleCards(column.cardIds)}
                  onRename={handleRenameColumn}
                  onRenameDone={handleRenameDone}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  onEditCard={handleEditCard}
                />
              ))}
            </section>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[260px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </main>
      {isActivityOpen && <ActivityPanel boardId={boardId} onClose={() => setIsActivityOpen(false)} />}
      <ChatSidebar
        boardId={boardId}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onBoardChange={setBoard}
        onBusyChange={setIsLocked}
      />
    </div>
  );
};
