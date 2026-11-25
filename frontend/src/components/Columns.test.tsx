import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { fakeBackend } from "@/test/fakeBackend";

const renderBoard = async () => {
  render(<KanbanBoard boardId={1} onLogout={() => {}} />);
  await screen.findByRole("heading", { name: "Kanban Studio" });
};

const columnTitles = () =>
  screen.getAllByLabelText("Column title").map((input) => (input as HTMLInputElement).value);

const addColumn = async (title: string) => {
  await userEvent.click(screen.getByRole("button", { name: "Add column" }));
  await userEvent.type(screen.getByLabelText("New column title"), title);
  await userEvent.click(screen.getByRole("button", { name: "Add" }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("columns", () => {
  it("adds a column at the end", async () => {
    const backend = fakeBackend();
    await renderBoard();

    await addColumn("Blocked");

    expect(columnTitles()).toEqual(["Backlog", "Discovery", "In Progress", "Review", "Done", "Blocked"]);
    const saved = backend.savedBoard().columns;
    expect(saved).toHaveLength(6);
    expect(saved[5]).toMatchObject({ title: "Blocked", cardIds: [] });
    expect(saved[5].id).toMatch(/^col-/);
  });

  it("cancels adding a column", async () => {
    const backend = fakeBackend();
    await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Add column" }));
    await userEvent.type(screen.getByLabelText("New column title"), "Never mind");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(columnTitles()).toHaveLength(5);
    expect(backend.saves).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Add column" })).toBeInTheDocument();
  });

  it("moves columns left and right", async () => {
    const backend = fakeBackend();
    await renderBoard();
    expect(screen.getByRole("button", { name: "Move Backlog left" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Done right" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Move Backlog right" }));
    expect(columnTitles()).toEqual(["Discovery", "Backlog", "In Progress", "Review", "Done"]);

    await userEvent.click(screen.getByRole("button", { name: "Move Done left" }));
    expect(columnTitles()).toEqual(["Discovery", "Backlog", "In Progress", "Done", "Review"]);
    expect(backend.savedBoard().columns.map((column) => column.id)).toEqual([
      "col-discovery",
      "col-backlog",
      "col-progress",
      "col-done",
      "col-review",
    ]);
    // Cards move with their column
    expect(backend.savedBoard().columns[1].cardIds).toEqual(["card-1", "card-2"]);
  });

  it("deletes only empty columns", async () => {
    const backend = fakeBackend();
    await renderBoard();
    expect(screen.getByRole("button", { name: "Delete column Review" })).toBeDisabled();

    const review = screen.getByTestId("column-col-review");
    await userEvent.click(within(review).getByRole("button", { name: "Delete QA micro-interactions" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete column Review" }));

    expect(columnTitles()).toEqual(["Backlog", "Discovery", "In Progress", "Done"]);
    expect(backend.savedBoard().columns.map((column) => column.id)).not.toContain("col-review");
  });

  it("keeps a column whose cards are hidden by the filter", async () => {
    fakeBackend();
    await renderBoard();
    await userEvent.type(screen.getByLabelText("Search cards"), "nothing matches");
    expect(screen.getByRole("button", { name: "Delete column Review" })).toBeDisabled();
  });

  it("restores the previous title when a rename is left blank", async () => {
    const backend = fakeBackend();
    await renderBoard();
    const input = screen.getAllByLabelText("Column title")[0];

    await userEvent.clear(input);
    await userEvent.tab();

    expect(input).toHaveValue("Backlog");
    expect(backend.savedBoard().columns[0].title).toBe("Backlog");
  });

  it("trims a renamed title", async () => {
    const backend = fakeBackend();
    await renderBoard();
    const input = screen.getAllByLabelText("Column title")[0];
    await userEvent.clear(input);
    await userEvent.type(input, "  Ideas  ");
    await userEvent.tab();

    expect(input).toHaveValue("Ideas");
    expect(backend.savedBoard().columns[0].title).toBe("Ideas");
  });

  it("stops offering new columns at the limit", async () => {
    fakeBackend();
    await renderBoard();
    for (let i = 6; i <= 12; i++) {
      await addColumn(`Column ${i}`);
    }
    expect(columnTitles()).toHaveLength(12);
    expect(screen.queryByRole("button", { name: "Add column" })).not.toBeInTheDocument();
  });
});
