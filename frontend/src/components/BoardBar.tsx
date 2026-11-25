import { useState, type FormEvent } from "react";
import type { BoardSummary } from "@/lib/api";

type BoardBarProps = {
  boards: BoardSummary[];
  currentId: number;
  error: string;
  onSelect: (id: number) => void;
  onCreate: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAccount: () => void;
};

type Mode = "idle" | "create" | "rename" | "delete";

const buttonClass =
  "rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]";
const primaryClass =
  "rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110";
const inputClass =
  "min-w-0 flex-1 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-base sm:text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]";

export const BoardBar = ({
  boards,
  currentId,
  error,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onAccount,
}: BoardBarProps) => {
  const [mode, setMode] = useState<Mode>("idle");
  const [name, setName] = useState("");
  const current = boards.find((board) => board.id === currentId);

  const open = (next: Mode) => {
    setName(next === "rename" ? current?.name ?? "" : "");
    setMode(next);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    if (mode === "create") {
      onCreate(trimmed);
    } else {
      onRename(trimmed);
    }
    setMode("idle");
  };

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--stroke)] pt-4">
      {mode === "create" || mode === "rename" ? (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label={mode === "create" ? "New board name" : "Board name"}
            placeholder="Board name"
            maxLength={80}
            autoFocus
            className={inputClass}
            required
          />
          <button type="submit" className={primaryClass}>
            {mode === "create" ? "Create" : "Save"}
          </button>
          <button type="button" onClick={() => setMode("idle")} className={buttonClass}>
            Cancel
          </button>
        </form>
      ) : mode === "delete" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-[var(--navy-dark)]">
            Delete <strong>{current?.name}</strong> and all its cards?
          </p>
          <button
            type="button"
            onClick={() => {
              setMode("idle");
              onDelete();
            }}
            className={primaryClass}
          >
            Delete board
          </button>
          <button type="button" onClick={() => setMode("idle")} className={buttonClass}>
            Keep it
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex w-full items-center gap-2 sm:w-auto">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Board
            </span>
            <select
              value={currentId}
              onChange={(event) => onSelect(Number(event.target.value))}
              aria-label="Current board"
              className="min-w-0 flex-1 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-base font-semibold text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] sm:w-64 sm:flex-none sm:text-sm"
            >
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => open("create")} aria-label="New board" className={buttonClass}>
            {/* Short label on phones so the buttons fit on one row */}
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New board</span>
          </button>
          <button type="button" onClick={() => open("rename")} className={buttonClass}>
            Rename
          </button>
          <button
            type="button"
            onClick={() => open("delete")}
            disabled={boards.length < 2}
            title={boards.length < 2 ? "You cannot delete your only board" : undefined}
            className={`${buttonClass} disabled:opacity-40`}
          >
            Delete
          </button>
          <button type="button" onClick={onAccount} className={`${buttonClass} sm:ml-auto`}>
            Account
          </button>
        </div>
      )}
      {error && <p className="text-sm font-semibold text-[var(--secondary-purple)]">{error}</p>}
    </div>
  );
};
