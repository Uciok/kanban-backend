import clsx from "clsx";
import type { BoardStats } from "@/lib/kanban";

type BoardSummaryProps = {
  stats: BoardStats;
};

// Totals for the open board (each column shows its own count)
export const BoardSummary = ({ stats }: BoardSummaryProps) => {
  const items = [
    { label: "Cards", value: stats.total, alert: false },
    { label: "Overdue", value: stats.overdue, alert: stats.overdue > 0 },
    { label: "Due this week", value: stats.dueSoon, alert: false },
    { label: "High priority", value: stats.highPriority, alert: false },
  ];
  return (
    <section aria-label="Board summary">
      <dl className="flex flex-wrap gap-x-4 gap-y-1 lg:gap-3">
        {items.map(({ label, value, alert }) => (
          <div
            key={label}
            data-testid={`stat-${label.toLowerCase().replaceAll(" ", "-")}`}
            className={clsx(
              "flex items-baseline gap-1.5 lg:rounded-2xl lg:border lg:px-4 lg:py-2",
              alert ? "lg:border-red-200 lg:bg-red-50" : "lg:border-[var(--stroke)] lg:bg-[var(--surface)]"
            )}
          >
            <dd className={clsx("font-display text-sm font-semibold lg:text-lg", alert ? "text-red-700" : "text-[var(--navy-dark)]")}>
              {value}
            </dd>
            <dt className="order-last text-xs text-[var(--gray-text)] lg:text-[11px] lg:font-semibold lg:uppercase lg:tracking-[0.2em]">
              {label}
            </dt>
          </div>
        ))}
      </dl>
    </section>
  );
};
