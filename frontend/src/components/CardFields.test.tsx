import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend } from "@/test/fakeBackend";
import { renderBoard } from "@/test/renderBoard";

const openEdit = async (cardId: string, title: string) => {
  const card = screen.getByTestId(`card-${cardId}`);
  await userEvent.click(within(card).getByRole("button", { name: `Edit ${title}` }));
  return card;
};

const visibleTitles = () =>
  screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);

describe("card fields", () => {
  it("shows priority and labels on cards", async () => {
    fakeBackend();
    await renderBoard();
    const meta = within(screen.getByTestId("card-card-1")).getByTestId("card-meta");
    expect(meta).toHaveTextContent("high");
    expect(meta).toHaveTextContent("#planning");
    expect(within(screen.getByTestId("card-card-8")).queryByTestId("card-meta")).not.toBeInTheDocument();
  });

  it("sets priority, due date and labels", async () => {
    const backend = fakeBackend();
    await renderBoard();
    const card = await openEdit("card-3", "Prototype analytics view");

    await userEvent.selectOptions(within(card).getByLabelText("Priority"), "medium");
    await userEvent.type(within(card).getByLabelText("Due date"), "2999-03-15");
    await userEvent.clear(within(card).getByLabelText("Labels"));
    await userEvent.type(within(card).getByLabelText("Labels"), "design, ux, design");
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));

    expect(backend.savedBoard().cards["card-3"]).toMatchObject({
      priority: "medium",
      dueDate: "2999-03-15",
      labels: ["design", "ux"],
    });
    const meta = within(card).getByTestId("card-meta");
    expect(meta).toHaveTextContent("medium");
    expect(meta).toHaveTextContent("Due Mar 15, 2999");
    expect(meta).toHaveTextContent("#ux");
  });

  it("clears priority, due date and labels", async () => {
    const backend = fakeBackend();
    await renderBoard();
    const card = await openEdit("card-1", "Align roadmap themes");
    expect(within(card).getByLabelText("Priority")).toHaveValue("high");
    expect(within(card).getByLabelText("Labels")).toHaveValue("planning");

    await userEvent.selectOptions(within(card).getByLabelText("Priority"), "");
    await userEvent.clear(within(card).getByLabelText("Labels"));
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));

    expect(backend.savedBoard().cards["card-1"]).toMatchObject({
      priority: null,
      dueDate: null,
      labels: [],
    });
    expect(within(card).queryByTestId("card-meta")).not.toBeInTheDocument();
  });

  it("marks past due dates as overdue", async () => {
    const backend = fakeBackend();
    await renderBoard();
    const card = await openEdit("card-4", "Refine status language");
    await userEvent.type(within(card).getByLabelText("Due date"), "2000-01-02");
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));

    expect(backend.savedBoard().cards["card-4"].dueDate).toBe("2000-01-02");
    expect(within(card).getByTestId("card-meta")).toHaveTextContent("Overdue Jan 2, 2000");
  });

  it("new cards start without priority, due date or labels", async () => {
    const backend = fakeBackend();
    await renderBoard();
    const column = screen.getByTestId("column-col-review");
    await userEvent.click(within(column).getByRole("button", { name: "Add a card" }));
    await userEvent.type(within(column).getByPlaceholderText("Card title"), "Fresh card");
    await userEvent.click(within(column).getByRole("button", { name: "Add card" }));

    const saved = Object.values(backend.savedBoard().cards).find((card) => card.title === "Fresh card");
    expect(saved).toMatchObject({ details: "", priority: null, dueDate: null, labels: [] });
  });
});

describe("filter bar", () => {
  it("searches titles, details and labels", async () => {
    fakeBackend();
    await renderBoard();
    expect(visibleTitles()).toHaveLength(8);

    await userEvent.type(screen.getByLabelText("Search cards"), "design");
    // "Design card layout" by title; "Prototype analytics view" by its label
    expect(visibleTitles()).toEqual(["Prototype analytics view", "Design card layout"]);
    expect(screen.getByText("Showing 2 of 8 cards")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Search cards"));
    await userEvent.type(screen.getByLabelText("Search cards"), "CHURN");
    expect(visibleTitles()).toEqual(["Gather customer signals"]);
  });

  it("filters by priority and combines with search", async () => {
    fakeBackend();
    await renderBoard();
    await userEvent.selectOptions(screen.getByLabelText("Filter by priority"), "high");
    expect(visibleTitles()).toEqual(["Align roadmap themes", "QA micro-interactions"]);

    await userEvent.type(screen.getByLabelText("Search cards"), "qa");
    expect(visibleTitles()).toEqual(["QA micro-interactions"]);
  });

  it("clears the filters", async () => {
    fakeBackend();
    await renderBoard();
    await userEvent.type(screen.getByLabelText("Search cards"), "nothing matches this");
    expect(screen.queryAllByRole("heading", { level: 4 })).toHaveLength(0);
    expect(screen.getByText("Showing 0 of 8 cards")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(visibleTitles()).toHaveLength(8);
    expect(screen.getByLabelText("Search cards")).toHaveValue("");
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it("keeps hidden cards when a shown card is deleted", async () => {
    const backend = fakeBackend();
    await renderBoard();
    await userEvent.type(screen.getByLabelText("Search cards"), "align");
    await userEvent.click(screen.getByRole("button", { name: "Delete Align roadmap themes" }));

    const saved = backend.savedBoard();
    expect(Object.keys(saved.cards)).toHaveLength(7);
    expect(saved.columns[0].cardIds).toEqual(["card-2"]);
  });
});
