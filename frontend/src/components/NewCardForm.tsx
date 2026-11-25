import { useState, type FormEvent } from "react";
import clsx from "clsx";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/lib/styles";

type NewCardFormProps = {
  onAdd: (title: string, details: string) => void;
};

export const NewCardForm = ({ onAdd }: NewCardFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  const close = () => {
    setIsOpen(false);
    setTitle("");
    setDetails("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    onAdd(title.trim(), details.trim());
    close();
  };

  return (
    <div className="mt-4">
      {isOpen ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Card title"
            className={clsx("w-full font-medium", inputClass)}
            required
          />
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Details"
            rows={3}
            className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-base sm:text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
          />
          <div className="flex items-center gap-2">
            <button type="submit" className={primaryButtonClass}>
              Add card
            </button>
            <button type="button" onClick={close} className={secondaryButtonClass}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full rounded-full border border-dashed border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)]"
        >
          Add a card
        </button>
      )}
    </div>
  );
};
