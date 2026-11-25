import {
  EMPTY_FILTER,
  addDays,
  boardStats,
  isFilterActive,
  isOverdue,
  matchesFilter,
  moveCard,
  parseLabels,
  relativeTime,
  todayString,
  type BoardData,
  type Card,
  type Column,
} from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });
});

describe("card helpers", () => {
  const card: Card = {
    id: "card-1",
    title: "Write launch email",
    details: "Draft for the newsletter",
    priority: "high",
    dueDate: "2026-11-20",
    labels: ["marketing", "q4"],
    checklist: [],
  };

  it("formats today in local time", () => {
    expect(todayString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("knows when a card is overdue", () => {
    expect(isOverdue(card, "2026-11-21")).toBe(true);
    expect(isOverdue(card, "2026-11-20")).toBe(false);
    expect(isOverdue({ ...card, dueDate: null }, "2026-11-21")).toBe(false);
  });

  it("parses labels", () => {
    expect(parseLabels(" a, b ,, a ,")).toEqual(["a", "b"]);
    expect(parseLabels("")).toEqual([]);
    expect(parseLabels("x".repeat(30))).toEqual(["x".repeat(24)]);
    expect(parseLabels("1,2,3,4,5,6,7,8,9")).toHaveLength(8);
  });

  it("filters by text in title, details or labels, ignoring case", () => {
    expect(matchesFilter(card, { text: "LAUNCH", priority: "" })).toBe(true);
    expect(matchesFilter(card, { text: "newsletter", priority: "" })).toBe(true);
    expect(matchesFilter(card, { text: "q4", priority: "" })).toBe(true);
    expect(matchesFilter(card, { text: "budget", priority: "" })).toBe(false);
    expect(matchesFilter(card, { text: "  ", priority: "" })).toBe(true);
  });

  it("filters by priority", () => {
    expect(matchesFilter(card, { text: "", priority: "high" })).toBe(true);
    expect(matchesFilter(card, { text: "", priority: "low" })).toBe(false);
    expect(matchesFilter(card, { text: "launch", priority: "low" })).toBe(false);
  });

  it("knows when a filter is active", () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(isFilterActive({ text: " x ", priority: "" })).toBe(true);
    expect(isFilterActive({ text: "", priority: "medium" })).toBe(true);
  });
});

describe("board stats", () => {
  const card = (id: string, fields: Partial<Card> = {}): Card => ({
    id,
    title: id,
    details: "",
    priority: null,
    dueDate: null,
    labels: [],
    checklist: [],
    ...fields,
  });

  const board: BoardData = {
    columns: [
      { id: "col-a", title: "To do", cardIds: ["a", "b", "c"] },
      { id: "col-b", title: "Done", cardIds: ["d", "e"] },
    ],
    cards: {
      a: card("a", { dueDate: "2026-11-24", priority: "high" }), // overdue
      b: card("b", { dueDate: "2026-11-25" }), // due today
      c: card("c", { dueDate: "2026-12-02", priority: "high" }), // due in 7 days
      d: card("d", { dueDate: "2026-12-03" }), // after the week
      e: card("e", { priority: "low" }),
    },
  };

  it("adds days across month ends", () => {
    expect(addDays("2026-11-28", 7)).toBe("2026-12-05");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("counts cards, overdue, due soon and high priority", () => {
    expect(boardStats(board, "2026-11-25")).toEqual({
      total: 5,
      overdue: 1,
      dueSoon: 2,
      highPriority: 2,
    });
  });

  it("handles an empty board", () => {
    const empty = { columns: [{ id: "col", title: "Only", cardIds: [] }], cards: {} };
    expect(boardStats(empty, "2026-11-25")).toMatchObject({ total: 0, overdue: 0, dueSoon: 0, highPriority: 0 });
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-11-25T12:00:00Z");

  it.each([
    ["2026-11-25 11:59:30", "just now"],
    ["2026-11-25 12:00:10", "just now"], // clock skew: never "in the future"
    ["2026-11-25 11:55:00", "5 min ago"],
    ["2026-11-25 09:00:00", "3 h ago"],
    ["2026-11-24 11:00:00", "yesterday"],
    ["2026-11-20 12:00:00", "5 days ago"],
  ])("%s is %s", (createdAt, expected) => {
    expect(relativeTime(createdAt, now)).toBe(expected);
  });
});
