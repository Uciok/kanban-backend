import { useRef } from "react";
import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canDelete: boolean;
  onRename: (columnId: string, title: string) => void;
  onRenameDone: (columnId: string, previousTitle: string) => void;
  onMove: (columnId: string, offset: -1 | 1) => void;
  onDelete: (columnId: string) => void;
  onAddCard: (columnId: string, title: string, details: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onEditCard: (cardId: string, changes: Omit<Card, "id">) => void;
};

const iconButtonClass =
  "rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)] disabled:opacity-30 disabled:hover:border-transparent";

export const KanbanColumn = ({
  column,
  cards,
  canMoveLeft,
  canMoveRight,
  canDelete,
  onRename,
  onRenameDone,
  onMove,
  onDelete,
  onAddCard,
  onDeleteCard,
  onEditCard,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  // Title when editing started, restored if the new title is left blank
  const titleBeforeEdit = useRef(column.title);

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex min-h-[360px] snap-center flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow)] transition lg:min-h-[520px]",
        isOver && "ring-2 ring-[var(--accent-yellow)]"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-2 w-6 shrink-0 rounded-full bg-[var(--accent-yellow)]" />
          <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
            {cards.length} cards
          </span>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => onMove(column.id, -1)}
            disabled={!canMoveLeft}
            aria-label={`Move ${column.title} left`}
            className={iconButtonClass}
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => onMove(column.id, 1)}
            disabled={!canMoveRight}
            aria-label={`Move ${column.title} right`}
            className={iconButtonClass}
          >
            →
          </button>
          <button
            type="button"
            onClick={() => onDelete(column.id)}
            disabled={!canDelete}
            aria-label={`Delete column ${column.title}`}
            title={canDelete ? undefined : "Only an empty column can be deleted, and a board keeps at least one"}
            className={iconButtonClass}
          >
            ✕
          </button>
        </div>
      </div>
      <input
        value={column.title}
        onChange={(event) => onRename(column.id, event.target.value)}
        onFocus={() => {
          titleBeforeEdit.current = column.title;
        }}
        onBlur={() => onRenameDone(column.id, titleBeforeEdit.current)}
        maxLength={60}
        className="mt-3 w-full bg-transparent font-display text-lg font-semibold text-[var(--navy-dark)] outline-none"
        aria-label="Column title"
      />
      <div className="mt-4 flex flex-1 flex-col gap-3">
        <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
              onEdit={onEditCard}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--stroke)] px-3 py-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Drop a card here
          </div>
        )}
      </div>
      <NewCardForm
        onAdd={(title, details) => onAddCard(column.id, title, details)}
      />
    </section>
  );
};
