import { useState, type KeyboardEvent } from "react";
import clsx from "clsx";
import { MAX_CHECKLIST_ITEMS, createId, type ChecklistItem } from "@/lib/kanban";
import { inputClass } from "@/lib/styles";

const itemInputClass = clsx("min-w-0 flex-1", inputClass);
const removeClass =
  "rounded-full px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]";

type ChecklistEditorProps = {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
};

// Checklist inside the card edit form: tick, rename, remove and add items
export const ChecklistEditor = ({ items, onChange }: ChecklistEditorProps) => {
  const [newText, setNewText] = useState("");

  const update = (id: string, changes: Partial<ChecklistItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const add = () => {
    const text = newText.trim();
    if (!text || items.length >= MAX_CHECKLIST_ITEMS) {
      return;
    }
    onChange([...items, { id: createId("item"), text, done: false }]);
    setNewText("");
  };

  // Enter adds the item instead of submitting the card form
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
        Checklist
      </legend>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={item.done}
            onChange={(event) => update(item.id, { done: event.target.checked })}
            aria-label={`Done: ${item.text}`}
            className="h-4 w-4 accent-[var(--secondary-purple)]"
          />
          <input
            value={item.text}
            onChange={(event) => update(item.id, { text: event.target.value })}
            aria-label="Checklist item"
            maxLength={120}
            className={itemInputClass}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((other) => other.id !== item.id))}
            aria-label={`Remove item ${item.text}`}
            className={removeClass}
          >
            ✕
          </button>
        </div>
      ))}
      {items.length < MAX_CHECKLIST_ITEMS && (
        <div className="flex items-center gap-2">
          <input
            value={newText}
            onChange={(event) => setNewText(event.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="New checklist item"
            placeholder="Add an item"
            maxLength={120}
            className={itemInputClass}
          />
          <button
            type="button"
            onClick={add}
            className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)]"
          >
            Add item
          </button>
        </div>
      )}
    </fieldset>
  );
};

type ChecklistViewProps = {
  items: ChecklistItem[];
  onToggle: (id: string, done: boolean) => void;
};

// Checklist on the card itself: progress, expands to tick items without opening the edit form
export const ChecklistView = ({ items, onToggle }: ChecklistViewProps) => {
  const [isOpen, setIsOpen] = useState(false);
  if (items.length === 0) {
    return null;
  }
  const done = items.filter((item) => item.done).length;
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 text-xs font-semibold text-[var(--navy-dark)]"
      >
        <span>
          Checklist {done}/{items.length}
        </span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface)]" aria-hidden="true">
          <span
            className="block h-full rounded-full bg-[var(--secondary-purple)]"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </span>
      </button>
      {isOpen && (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <label className="flex items-start gap-2 text-sm text-[var(--navy-dark)]">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(event) => onToggle(item.id, event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[var(--secondary-purple)]"
                />
                <span className={item.done ? "text-[var(--gray-text)] line-through" : undefined}>{item.text}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
