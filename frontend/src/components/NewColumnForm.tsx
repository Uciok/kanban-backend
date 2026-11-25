import { useState, type FormEvent } from "react";
import clsx from "clsx";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/lib/styles";

type NewColumnFormProps = {
  onAdd: (title: string) => void;
};

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
        className="rounded-full border border-dashed border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)]"
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
        className={clsx("min-w-0", inputClass)}
      />
      <button type="submit" className={primaryButtonClass}>
        Add
      </button>
      <button type="button" onClick={close} className={secondaryButtonClass}>
        Cancel
      </button>
    </form>
  );
};
