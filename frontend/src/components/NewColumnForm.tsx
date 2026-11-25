import { useState, type FormEvent } from "react";

type NewColumnFormProps = {
  onAdd: (title: string) => void;
};

const buttonClass =
  "rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide transition";

export const NewColumnForm = ({ onAdd }: NewColumnFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");

  const close = () => {
    setIsOpen(false);
    setTitle("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    onAdd(title.trim());
    close();
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`${buttonClass} border-dashed text-[var(--primary-blue)] hover:border-[var(--primary-blue)]`}
      >
        Add column
      </button>
    );
  }
  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        aria-label="New column title"
        placeholder="Column title"
        maxLength={60}
        autoFocus
        required
        className="min-w-0 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-base sm:text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
      />
      <button type="submit" className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110">
        Add
      </button>
      <button type="button" onClick={close} className={`${buttonClass} text-[var(--gray-text)] hover:text-[var(--navy-dark)]`}>
        Cancel
      </button>
    </form>
  );
};
