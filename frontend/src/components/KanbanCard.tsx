import { useState, type FormEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { ChecklistEditor, ChecklistView } from "@/components/Checklist";
import {
  PRIORITIES,
  isOverdue,
  parseLabels,
  todayString,
  type Card,
  type ChecklistItem,
  type Priority,
} from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onEdit: (cardId: string, changes: Omit<Card, "id">) => void;
};

const PRIORITY_STYLES: Record<Priority, string> = {
  high: "bg-[var(--secondary-purple)] text-white",
  medium: "bg-[var(--accent-yellow)] text-[var(--navy-dark)]",
  low: "bg-[var(--surface)] text-[var(--gray-text)] border border-[var(--stroke)]",
};

const inputClass =
  "w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-base sm:text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]";

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Priority, due date and labels; shared by the card and its drag preview
export const CardMeta = ({ card }: { card: Card }) => {
  if (!card.priority && !card.dueDate && card.labels.length === 0) {
    return null;
  }
  const overdue = isOverdue(card, todayString());
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5" data-testid="card-meta">
      {card.priority && (
        <span
          className={clsx(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
            PRIORITY_STYLES[card.priority]
          )}
        >
          {card.priority}
        </span>
      )}
      {card.dueDate && (
        <span
          className={clsx(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            overdue
              ? "bg-red-50 text-red-700 border border-red-200"
              : "border border-[var(--stroke)] text-[var(--navy-dark)]"
          )}
        >
          {overdue ? "Overdue " : "Due "}
          {formatDate(card.dueDate)}
        </span>
      )}
      {card.labels.map((label) => (
        <span
          key={label}
          className="rounded-full bg-[rgba(32,157,215,0.1)] px-2 py-0.5 text-[11px] font-semibold text-[var(--primary-blue)]"
        >
          #{label}
        </span>
      ))}
    </div>
  );
};

export const KanbanCard = ({ card, onDelete, onEdit }: KanbanCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [priority, setPriority] = useState<Priority | "">(card.priority ?? "");
  const [dueDate, setDueDate] = useState(card.dueDate ?? "");
  const [labels, setLabels] = useState(card.labels.join(", "));
  const [checklist, setChecklist] = useState<ChecklistItem[]>(card.checklist);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const startEditing = () => {
    setTitle(card.title);
    setDetails(card.details);
    setPriority(card.priority ?? "");
    setDueDate(card.dueDate ?? "");
    setLabels(card.labels.join(", "));
    setChecklist(card.checklist);
    setIsEditing(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    onEdit(card.id, {
      title: title.trim(),
      details: details.trim(),
      priority: priority || null,
      dueDate: dueDate || null,
      labels: parseLabels(labels),
      // Items left blank are dropped
      checklist: checklist
        .map((item) => ({ ...item, text: item.text.trim() }))
        .filter((item) => item.text),
    });
    setIsEditing(false);
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        // No text selection or iOS callout on the long press that starts a drag
        "select-none [-webkit-touch-callout:none]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...(isEditing ? {} : { ...attributes, ...listeners })}
      data-testid={`card-${card.id}`}
    >
      {isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Card title"
            className={clsx(inputClass, "font-medium")}
            required
          />
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            aria-label="Card details"
            rows={3}
            className={clsx(inputClass, "resize-none text-[var(--gray-text)]")}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority | "")}
              aria-label="Priority"
              className={inputClass}
            >
              <option value="">No priority</option>
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value[0].toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              aria-label="Due date"
              className={inputClass}
            />
          </div>
          <input
            value={labels}
            onChange={(event) => setLabels(event.target.value)}
            aria-label="Labels"
            placeholder="Labels, comma separated"
            className={inputClass}
          />
          <ChecklistEditor items={checklist} onChange={setChecklist} />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
                {card.title}
              </h4>
              <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
                {card.details}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={startEditing}
                className="rounded-full border border-transparent px-3 py-2 text-xs font-semibold text-[var(--primary-blue)] lg:px-2 lg:py-1 transition hover:border-[var(--stroke)]"
                aria-label={`Edit ${card.title}`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(card.id)}
                className="rounded-full border border-transparent px-3 py-2 text-xs font-semibold text-[var(--gray-text)] lg:px-2 lg:py-1 transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
                aria-label={`Delete ${card.title}`}
              >
                Remove
              </button>
            </div>
          </div>
          <CardMeta card={card} />
          <ChecklistView
            items={card.checklist}
            onToggle={(id, done) => {
              const { id: cardId, ...fields } = card;
              onEdit(cardId, {
                ...fields,
                checklist: card.checklist.map((item) => (item.id === id ? { ...item, done } : item)),
              });
            }}
          />
        </>
      )}
    </article>
  );
};
