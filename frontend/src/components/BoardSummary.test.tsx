import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { fakeBackend } from "@/test/fakeBackend";

const renderBoard = async () => {
  render(<KanbanBoard boardId={1} onLogout={() => {}} />);
  await screen.findByRole("heading", { name: "Kanban Studio" });
};

const stat = (name: string) => screen.getByTestId(`stat-${name}`);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("board summary", () => {
  it("shows totals", async () => {
    fakeBackend();
    await renderBoard();
    expect(stat("cards")).toHaveTextContent("8Cards");
    expect(stat("overdue")).toHaveTextContent("0Overdue");
    expect(stat("due-this-week")).toHaveTextContent("0Due this week");
    expect(stat("high-priority")).toHaveTextContent("2High priority");
  });

  it("follows changes to the board", async () => {
    fakeBackend();
    await renderBoard();

    await userEvent.click(screen.getByRole("button", { name: "Delete Align roadmap themes" }));
    expect(stat("cards")).toHaveTextContent("7Cards");
    expect(stat("high-priority")).toHaveTextContent("1High priority");

    const card = screen.getByTestId("card-card-4");
    await userEvent.click(within(card).getByRole("button", { name: "Edit Refine status language" }));
    await userEvent.type(within(card).getByLabelText("Due date"), "2000-01-01");
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));
    expect(stat("overdue")).toHaveTextContent("1Overdue");
  });

  it("counts every card, not only the filtered ones", async () => {
    fakeBackend();
    await renderBoard();
    await userEvent.type(screen.getByLabelText("Search cards"), "align");
    expect(stat("cards")).toHaveTextContent("8Cards");
  });
});
