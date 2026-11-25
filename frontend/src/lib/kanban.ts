export type Priority = "low" | "medium" | "high";

export type ChecklistItem = { id: string; text: string; done: boolean };

export type Card = {
  id: string;
  title: string;
  details: string;
  priority: Priority | null;
  dueDate: string | null; // "YYYY-MM-DD"
  labels: string[];
  checklist: ChecklistItem[];
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
};

const isColumnId = (columns: Column[], id: string) =>
  columns.some((column) => column.id === id);

const findColumnId = (columns: Column[], id: string) => {
  if (isColumnId(columns, id)) {
    return id;
  }
  return columns.find((column) => column.cardIds.includes(id))?.id;
};

export const moveCard = (
  columns: Column[],
  activeId: string,
  overId: string
): Column[] => {
  const activeColumnId = findColumnId(columns, activeId);
  const overColumnId = findColumnId(columns, overId);

  if (!activeColumnId || !overColumnId) {
    return columns;
  }

  const activeColumn = columns.find((column) => column.id === activeColumnId);
  const overColumn = columns.find((column) => column.id === overColumnId);

  if (!activeColumn || !overColumn) {
    return columns;
  }

  const isOverColumn = isColumnId(columns, overId);

  if (activeColumnId === overColumnId) {
    if (isOverColumn) {
      const nextCardIds = activeColumn.cardIds.filter(
        (cardId) => cardId !== activeId
      );
      nextCardIds.push(activeId);
      return columns.map((column) =>
        column.id === activeColumnId
          ? { ...column, cardIds: nextCardIds }
          : column
      );
    }

    const oldIndex = activeColumn.cardIds.indexOf(activeId);
    const newIndex = activeColumn.cardIds.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      return columns;
    }

    const nextCardIds = [...activeColumn.cardIds];
    nextCardIds.splice(oldIndex, 1);
    nextCardIds.splice(newIndex, 0, activeId);

    return columns.map((column) =>
      column.id === activeColumnId
        ? { ...column, cardIds: nextCardIds }
        : column
    );
  }

  const activeIndex = activeColumn.cardIds.indexOf(activeId);
  if (activeIndex === -1) {
    return columns;
  }

  const nextActiveCardIds = [...activeColumn.cardIds];
  nextActiveCardIds.splice(activeIndex, 1);

  const nextOverCardIds = [...overColumn.cardIds];
  if (isOverColumn) {
    nextOverCardIds.push(activeId);
  } else {
    const overIndex = overColumn.cardIds.indexOf(overId);
    const insertIndex = overIndex === -1 ? nextOverCardIds.length : overIndex;
    nextOverCardIds.splice(insertIndex, 0, activeId);
  }

  return columns.map((column) => {
    if (column.id === activeColumnId) {
      return { ...column, cardIds: nextActiveCardIds };
    }
    if (column.id === overColumnId) {
      return { ...column, cardIds: nextOverCardIds };
    }
    return column;
  });
};

export const createId = (prefix: string) => {
  const randomPart = Math.random().toString(36).slice(2, 8);
  const timePart = Date.now().toString(36);
  return `${prefix}-${randomPart}${timePart}`;
};

export const PRIORITIES: Priority[] = ["high", "medium", "low"];
export const MAX_LABELS = 8;
export const MAX_COLUMNS = 12;
export const MAX_CHECKLIST_ITEMS = 20;
export const MAX_LABEL_LENGTH = 24;

// Today as "YYYY-MM-DD" in local time
export const todayString = (now = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const isOverdue = (card: Card, today: string) =>
  card.dueDate !== null && card.dueDate < today;

// "a, b, , a" -> ["a", "b"]: trimmed, no blanks or duplicates, within the backend's limits
export const parseLabels = (text: string) =>
  [...new Set(text.split(",").map((label) => label.trim()).filter(Boolean))]
    .map((label) => label.slice(0, MAX_LABEL_LENGTH))
    .slice(0, MAX_LABELS);

export type CardFilter = { text: string; priority: Priority | "" };

export const EMPTY_FILTER: CardFilter = { text: "", priority: "" };

export const isFilterActive = (filter: CardFilter) =>
  filter.text.trim() !== "" || filter.priority !== "";

export const matchesFilter = (card: Card, filter: CardFilter) => {
  if (filter.priority && card.priority !== filter.priority) {
    return false;
  }
  const query = filter.text.trim().toLowerCase();
  if (!query) {
    return true;
  }
  return [card.title, card.details, ...card.labels].some((text) =>
    text.toLowerCase().includes(query)
  );
};

// "YYYY-MM-DD" plus a number of days
export const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return todayString(date);
};

export type BoardStats = {
  total: number;
  overdue: number;
  // Due today or within the next 7 days
  dueSoon: number;
  highPriority: number;
};

export const boardStats = (board: BoardData, today: string): BoardStats => {
  const cards = Object.values(board.cards);
  const weekAhead = addDays(today, 7);
  return {
    total: cards.length,
    overdue: cards.filter((card) => isOverdue(card, today)).length,
    dueSoon: cards.filter((card) => card.dueDate !== null && card.dueDate >= today && card.dueDate <= weekAhead).length,
    highPriority: cards.filter((card) => card.priority === "high").length,
  };
};

// "2/5" style progress, or null for a card without a checklist
export const checklistProgress = (card: Card) =>
  card.checklist.length === 0
    ? null
    : { done: card.checklist.filter((item) => item.done).length, total: card.checklist.length };

// "2026-11-25 10:00:00" (UTC, as SQLite stores it) -> "5 min ago"
export const relativeTime = (createdAt: string, now = new Date()) => {
  const seconds = Math.max(0, (now.getTime() - new Date(`${createdAt.replace(" ", "T")}Z`).getTime()) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} min ago`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} h ago`;
  }
  const days = Math.floor(seconds / 86400);
  return days === 1 ? "yesterday" : `${days} days ago`;
};
