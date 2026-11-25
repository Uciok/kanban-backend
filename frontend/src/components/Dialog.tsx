import type { ReactNode } from "react";
import clsx from "clsx";
import { secondaryButtonClass } from "@/lib/styles";

type DialogProps = {
  // Heading and accessible name
  title: string;
  description: ReactNode;
  onClose: () => void;
  className?: string;
  children: ReactNode;
};

// Modal over a dimmed page, with a header and a Close button
export const Dialog = ({ title, description, onClose, className, children }: DialogProps) => (
  <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-[rgba(3,33,71,0.35)] p-4 sm:items-center">
    <section
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={clsx(
        "w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]",
        className
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="h-1 w-10 rounded-full bg-[var(--accent-yellow)]" />
          <h2 className="mt-3 font-display text-xl font-semibold text-[var(--navy-dark)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--gray-text)]">{description}</p>
        </div>
        <button type="button" onClick={onClose} className={secondaryButtonClass}>
          Close
        </button>
      </header>
      {children}
    </section>
  </div>
);
