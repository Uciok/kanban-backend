import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { fakeBackend } from "@/test/fakeBackend";

const renderBoard = async () => {
  render(<KanbanBoard boardId={1} onLogout={() => {}} />);
  await screen.findByRole("heading", { name: "Kanban Studio" });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("activity panel", () => {
  it("lists the board's recent changes, newest first as given", async () => {
    const backend = fakeBackend();
    backend.activity[1] = [
      { id: 2, summary: 'Edited card "Align roadmap themes"', created_at: "2000-01-01 10:00:00", username: "user" },
      { id: 1, summary: "Created the board", created_at: "2000-01-01 09:00:00", username: "user" },
    ];
    await renderBoard();

    await userEvent.click(screen.getByRole("button", { name: "Activity" }));
    const list = await screen.findByRole("list", { name: "Recent changes" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.querySelector("p")!.textContent)).toEqual([
      'Edited card "Align roadmap themes"',
      "Created the board",
    ]);
    expect(items[0]).toHaveTextContent(/user · \d+ days ago/);
  });

  it("says when there is no activity, and closes", async () => {
    fakeBackend();
    await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Activity" }));
    expect(await screen.findByText("No activity yet.")).toBeInTheDocument();

    await userEvent.click(within(screen.getByRole("dialog", { name: "Activity" })).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loads fresh events each time it opens", async () => {
    const backend = fakeBackend();
    await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Activity" }));
    await screen.findByText("No activity yet.");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));

    backend.activity[1] = [{ id: 1, summary: "Reordered columns", created_at: "2000-01-01 09:00:00", username: "user" }];
    await userEvent.click(screen.getByRole("button", { name: "Activity" }));
    expect(await screen.findByText("Reordered columns")).toBeInTheDocument();
  });
});
