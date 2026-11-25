import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { fakeBackend } from "@/test/fakeBackend";

const renderBoard = async () => {
  render(<KanbanBoard boardId={1} onLogout={() => {}} />);
  await screen.findByRole("heading", { name: "Kanban Studio" });
};

const card = (id: string) => screen.getByTestId(`card-${id}`);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checklists", () => {
  it("shows progress and only cards with a checklist get one", async () => {
    fakeBackend();
    await renderBoard();
    expect(within(card("card-1")).getByRole("button", { name: /Checklist 1\/3/ })).toBeInTheDocument();
    expect(within(card("card-2")).queryByRole("button", { name: /Checklist/ })).not.toBeInTheDocument();
  });

  it("ticks items on the card without opening the edit form", async () => {
    const backend = fakeBackend();
    await renderBoard();
    const toggle = within(card("card-1")).getByRole("button", { name: /Checklist 1\/3/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(within(card("card-1")).getByRole("checkbox", { name: "Draft three themes" }));

    expect(within(card("card-1")).getByRole("button", { name: /Checklist 2\/3/ })).toBeInTheDocument();
    expect(backend.savedBoard().cards["card-1"].checklist.map((item) => item.done)).toEqual([true, true, false]);
    // Other fields are kept
    expect(backend.savedBoard().cards["card-1"]).toMatchObject({ priority: "high", labels: ["planning"] });

    await userEvent.click(toggle);
    expect(within(card("card-1")).queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("adds, renames, ticks and removes items in the edit form", async () => {
    const backend = fakeBackend();
    await renderBoard();
    await userEvent.click(within(card("card-2")).getByRole("button", { name: "Edit Gather customer signals" }));
    const form = card("card-2");

    // Enter adds the item and does not submit the form
    await userEvent.type(within(form).getByLabelText("New checklist item"), "Call five customers{Enter}");
    await userEvent.type(within(form).getByLabelText("New checklist item"), "Read churn notes");
    await userEvent.click(within(form).getByRole("button", { name: "Add item" }));
    await userEvent.type(within(form).getByLabelText("New checklist item"), "Temporary");
    await userEvent.click(within(form).getByRole("button", { name: "Add item" }));
    expect(backend.saves).toHaveLength(0);

    const texts = within(form).getAllByLabelText("Checklist item");
    await userEvent.clear(texts[1]);
    await userEvent.type(texts[1], "Read the churn notes");
    await userEvent.click(within(form).getByRole("checkbox", { name: "Done: Call five customers" }));
    await userEvent.click(within(form).getByRole("button", { name: "Remove item Temporary" }));
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));

    const saved = backend.savedBoard().cards["card-2"].checklist;
    expect(saved.map(({ text, done }) => ({ text, done }))).toEqual([
      { text: "Call five customers", done: true },
      { text: "Read the churn notes", done: false },
    ]);
    expect(new Set(saved.map((item) => item.id)).size).toBe(2);
    expect(within(card("card-2")).getByRole("button", { name: /Checklist 1\/2/ })).toBeInTheDocument();
  });

  it("drops blank items and ignores blank new items", async () => {
    const backend = fakeBackend();
    await renderBoard();
    await userEvent.click(within(card("card-1")).getByRole("button", { name: "Edit Align roadmap themes" }));
    const form = card("card-1");
    await userEvent.click(within(form).getByRole("button", { name: "Add item" }));
    expect(within(form).getAllByLabelText("Checklist item")).toHaveLength(3);

    await userEvent.clear(within(form).getAllByLabelText("Checklist item")[2]);
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect(backend.savedBoard().cards["card-1"].checklist.map((item) => item.text)).toEqual([
      "Collect input from team leads",
      "Draft three themes",
    ]);
  });

  it("cancelling the edit keeps the checklist as it was", async () => {
    const backend = fakeBackend();
    await renderBoard();
    await userEvent.click(within(card("card-1")).getByRole("button", { name: "Edit Align roadmap themes" }));
    await userEvent.click(within(card("card-1")).getByRole("button", { name: "Remove item Draft three themes" }));
    await userEvent.click(within(card("card-1")).getByRole("button", { name: "Cancel" }));

    expect(backend.saves).toHaveLength(0);
    expect(within(card("card-1")).getByRole("button", { name: /Checklist 1\/3/ })).toBeInTheDocument();
  });

  it("stops adding at 20 items", async () => {
    fakeBackend();
    await renderBoard();
    await userEvent.click(within(card("card-3")).getByRole("button", { name: "Edit Prototype analytics view" }));
    const form = card("card-3");
    for (let i = 1; i <= 20; i++) {
      await userEvent.type(within(form).getByLabelText("New checklist item"), `Item ${i}{Enter}`);
    }
    expect(within(form).getAllByLabelText("Checklist item")).toHaveLength(20);
    expect(within(form).queryByLabelText("New checklist item")).not.toBeInTheDocument();
  });
});
