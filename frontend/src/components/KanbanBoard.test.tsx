import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend } from "@/test/fakeBackend";
import { renderBoard } from "@/test/renderBoard";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("loads the board from the API", async () => {
    const backend = fakeBackend();
    const board = backend.savedBoard();
    board.cards["card-1"].title = "Saved earlier";
    await renderBoard();
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
    expect(screen.getByText("Saved earlier")).toBeInTheDocument();
  });

  it("renames a column and saves on blur, not on every keystroke", async () => {
    const backend = fakeBackend();
    await renderBoard();
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
    expect(backend.saves).toHaveLength(0);

    await userEvent.tab();
    expect(backend.saves).toHaveLength(1);
    expect(backend.savedBoard().columns[0].title).toBe("New Name");
  });

  it("adds and removes a card, saving each change", async () => {
    const backend = fakeBackend();
    await renderBoard();
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();
    const saved = backend.savedBoard();
    const newId = saved.columns[0].cardIds.at(-1)!;
    expect(saved.cards[newId]).toMatchObject({ title: "New card", details: "Notes" });

    await userEvent.click(within(column).getByRole("button", { name: /delete new card/i }));
    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
    expect(backend.savedBoard().cards[newId]).toBeUndefined();
    expect(backend.savedBoard().columns[0].cardIds).not.toContain(newId);
    expect(backend.saves).toHaveLength(2);
  });

  it("edits a card and saves it", async () => {
    const backend = fakeBackend();
    await renderBoard();
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: /edit align roadmap themes/i }));

    const titleInput = within(card).getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated title");
    const detailsInput = within(card).getByLabelText("Card details");
    await userEvent.clear(detailsInput);
    await userEvent.type(detailsInput, "Updated details");
    await userEvent.click(within(card).getByRole("button", { name: /save/i }));

    expect(within(card).getByText("Updated title")).toBeInTheDocument();
    expect(within(card).getByText("Updated details")).toBeInTheDocument();
    expect(backend.savedBoard().cards["card-1"]).toEqual({
      id: "card-1",
      title: "Updated title",
      details: "Updated details",
      // Fields not touched in the form stay as they were
      priority: "high",
      dueDate: null,
      labels: ["planning"],
      checklist: [
        { id: "item-1", text: "Collect input from team leads", done: true },
        { id: "item-2", text: "Draft three themes", done: false },
        { id: "item-3", text: "Review with leadership", done: false },
      ],
    });
  });

  it("cancels editing without changes or saving", async () => {
    const backend = fakeBackend();
    await renderBoard();
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: /edit align roadmap themes/i }));

    const titleInput = within(card).getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Discarded");
    await userEvent.click(within(card).getByRole("button", { name: /cancel/i }));

    expect(within(card).getByText("Align roadmap themes")).toBeInTheDocument();
    expect(within(card).queryByText("Discarded")).not.toBeInTheDocument();
    expect(backend.saves).toHaveLength(0);
  });

  it("does not save an empty title", async () => {
    const backend = fakeBackend();
    await renderBoard();
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: /edit align roadmap themes/i }));

    await userEvent.clear(within(card).getByLabelText("Card title"));
    await userEvent.click(within(card).getByRole("button", { name: /save/i }));

    expect(within(card).getByLabelText("Card title")).toBeInTheDocument();
    expect(backend.saves).toHaveLength(0);
  });
});
