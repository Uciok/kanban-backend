import { useEffect, useState } from "react";
import { getActivity, type ActivityEvent } from "@/lib/api";
import { relativeTime } from "@/lib/kanban";

type ActivityPanelProps = {
  boardId: number;
  onClose: () => void;
};

// Recent changes to the board, loaded each time the panel opens
export const ActivityPanel = ({ boardId, onClose }: ActivityPanelProps) => {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);

  useEffect(() => {
    getActivity(boardId).then(setEvents);
  }, [boardId]);

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-[rgba(3,33,71,0.35)] p-4 sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Activity"
        className="w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="h-1 w-10 rounded-full bg-[var(--accent-yellow)]" />
            <h2 className="mt-3 font-display text-xl font-semibold text-[var(--navy-dark)]">Activity</h2>
            <p className="mt-1 text-sm text-[var(--gray-text)]">The latest 50 changes to this board.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          >
            Close
          </button>
        </header>
        {events === null ? null : events.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--gray-text)]">No activity yet.</p>
        ) : (
          <ol className="mt-6 max-h-[60vh] space-y-3 overflow-y-auto" aria-label="Recent changes">
            {events.map((event) => (
              <li key={event.id} className="border-l-2 border-[var(--accent-yellow)] pl-3">
                <p className="text-sm text-[var(--navy-dark)]">{event.summary}</p>
                <p className="text-xs text-[var(--gray-text)]">
                  {event.username} · {relativeTime(event.created_at)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};
