import { useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
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
    <Dialog title="Activity" description="The latest 50 changes to this board." onClose={onClose}>
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
    </Dialog>
  );
};
