import type { ReactNode } from "react";
import clsx from "clsx";
import {
  EMPTY_FILTER,
  PRIORITIES,
  PRIORITY_LABELS,
  isFilterActive,
  type CardFilter,
  type Priority,
} from "@/lib/kanban";
import { inputClass, secondaryButtonClass } from "@/lib/styles";

type FilterBarProps = {
  // Extra controls shown after the filters (e.g. Add column)
  actions?: ReactNode;
  filter: CardFilter;
  shown: number;
  total: number;
  onChange: (filter: CardFilter) => void;
};

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
        className={clsx("w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-xs", inputClass)}
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
            {PRIORITY_LABELS[value]} priority
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
            onClick={() => onChange(EMPTY_FILTER)}
            className={secondaryButtonClass}
          >
            Clear filters
          </button>
        </>
      )}
      {actions && <div className="sm:ml-auto">{actions}</div>}
    </div>
  );
};
