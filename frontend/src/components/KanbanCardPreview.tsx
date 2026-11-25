import { CardMeta, CardText } from "@/components/KanbanCard";
import type { Card } from "@/lib/kanban";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => (
  <article className="rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_18px_32px_rgba(3,33,71,0.16)]">
    <div className="flex items-start justify-between gap-3">
      <CardText card={card} />
    </div>
    <CardMeta card={card} />
  </article>
);
