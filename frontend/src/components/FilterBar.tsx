import type { ReactNode } from "react";
import { PRIORITIES, isFilterActive, type CardFilter, type Priority } from "@/lib/kanban";

type FilterBarProps = {
  // Extra controls shown after the filters (e.g. Add column)
  actions?: ReactNode;
  filter: CardFilter;
  shown: number;
  total: number;
  onChange: (filter: CardFilter) => void;
};

const inputClass =
  "rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-base sm:text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]";

export const FilterBar = ({ actions, filter, shown, total, onChange }: FilterBarProps) => {
  const active = isFilterActive(filter);
  return (
    <div className="flex flex-wrap items-center gap-2" role="search">
      <input
        type="search"
        value={filter.text}
        onChange={(event) => onChange({ ...filter, text: event.target.value })}
        aria-label="Search cards"
        placeholder="Search cards and labels"
        className={`${inputClass} w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-xs`}
      />
      <select
        value={filter.priority}
        onChange={(event) => onChange({ ...filter, priority: event.target.value as Priority | "" })}
        aria-label="Filter by priority"
        className={inputClass}
      >
        <option value="">Any priority</option>
        {PRIORITIES.map((value) => (
          <option key={value} value={value}>
            {value[0].toUpperCase() + value.slice(1)} priority
          </option>
        ))}
      </select>
      {active && (
        <>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Showing {shown} of {total} cards
          </span>
          <button
            type="button"
            onClick={() => onChange({ text: "", priority: "" })}
            className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          >
            Clear filters
          </button>
        </>
      )}
      {actions && <div className="sm:ml-auto">{actions}</div>}
    </div>
  );
};
