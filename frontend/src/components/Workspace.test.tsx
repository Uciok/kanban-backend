import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/components/App";
import { fakeBackend, jsonResponse } from "@/test/fakeBackend";

const renderApp = async () => {
  render(<App />);
  await screen.findByRole("heading", { name: "Kanban Studio" });
};

const boardSelect = () => screen.getByRole("combobox", { name: "Current board" });
const boardNames = () =>
  within(boardSelect())
    .getAllByRole("option")
    .map((option) => option.textContent);

const createBoard = async (name: string) => {
  await userEvent.click(screen.getByRole("button", { name: "New board" }));
  await userEvent.type(screen.getByLabelText("New board name"), name);
  await userEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByRole("option", { name });
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("Workspace boards", () => {
  it("opens the first board", async () => {
    fakeBackend();
    await renderApp();
    expect(boardNames()).toEqual(["My board"]);
    expect(boardSelect()).toHaveValue("1");
    expect(screen.getByText("Align roadmap themes")).toBeInTheDocument();
  });

  it("creates a board and switches to it", async () => {
    const backend = fakeBackend();
    await renderApp();

    await createBoard("Launch plan");

    expect(boardNames()).toEqual(["My board", "Launch plan"]);
    expect(boardSelect()).toHaveValue("2");
    expect(backend.boards().map((board) => board.name)).toEqual(["My board", "Launch plan"]);
    // The new board has the columns but no cards
    expect(screen.getByLabelText("Column title", { selector: "[value='Backlog']" })).toBeInTheDocument();
    expect(screen.queryByText("Align roadmap themes")).not.toBeInTheDocument();
  });

  it("switches between boards and saves to the open board", async () => {
    const backend = fakeBackend();
    await renderApp();
    await createBoard("Second");

    await userEvent.selectOptions(boardSelect(), "1");
    expect(await screen.findByText("Align roadmap themes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete Align roadmap themes" }));

    expect(backend.saveLog.map((save) => save.id)).toEqual([1]);
    expect(backend.savedBoard(1).cards["card-1"]).toBeUndefined();
    expect(backend.savedBoard(2).cards).toEqual({});
  });

  it("remembers the open board across reloads", async () => {
    fakeBackend();
    const view = render(<App />);
    await screen.findByRole("heading", { name: "Kanban Studio" });
    await createBoard("Second");
    view.unmount();

    await renderApp();
    expect(boardSelect()).toHaveValue("2");
  });

  it("falls back to the first board when the remembered one is gone", async () => {
    localStorage.setItem("pm-current-board", "99");
    fakeBackend();
    await renderApp();
    expect(boardSelect()).toHaveValue("1");
  });

  it("renames the open board", async () => {
    const backend = fakeBackend();
    await renderApp();

    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    const input = screen.getByLabelText("Board name");
    expect(input).toHaveValue("My board");
    await userEvent.clear(input);
    await userEvent.type(input, "Roadmap");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("option", { name: "Roadmap" })).toBeInTheDocument();
    expect(backend.boards()[0].name).toBe("Roadmap");
  });

  it("cancels creating a board", async () => {
    const backend = fakeBackend();
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: "New board" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(boardNames()).toEqual(["My board"]);
    expect(backend.boards()).toHaveLength(1);
  });

  it("deletes a board after confirming", async () => {
    const backend = fakeBackend();
    await renderApp();
    await createBoard("Temporary");

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/and all its cards\?/)).toHaveTextContent("Delete Temporary and all its cards?");
    await userEvent.click(screen.getByRole("button", { name: "Delete board" }));

    expect(await screen.findByText("Align roadmap themes")).toBeInTheDocument();
    expect(boardNames()).toEqual(["My board"]);
    expect(backend.boards().map((board) => board.name)).toEqual(["My board"]);
  });

  it("keeps the board when deletion is cancelled", async () => {
    const backend = fakeBackend();
    await renderApp();
    await createBoard("Keep me");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(backend.boards()).toHaveLength(2);
    expect(boardSelect()).toHaveValue("2");
  });

  it("does not offer deleting the only board", async () => {
    fakeBackend();
    await renderApp();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });

  it("keeps a separate chat for each board", async () => {
    fakeBackend({
      chat: ({ boardId, message }) =>
        jsonResponse(200, { reply: `Board ${boardId}: ${message}`, board: null }),
    });
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: "AI chat" }));
    await userEvent.type(screen.getByLabelText("Message"), "Hello first");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Board 1: Hello first")).toBeInTheDocument();

    await createBoard("Second");
    await userEvent.click(screen.getByRole("button", { name: "AI chat" }));
    expect(screen.queryByText("Board 1: Hello first")).not.toBeInTheDocument();

    await userEvent.selectOptions(boardSelect(), "1");
    await screen.findByText("Align roadmap themes");
    await userEvent.click(screen.getByRole("button", { name: "AI chat" }));
    expect(screen.getByText("Board 1: Hello first")).toBeInTheDocument();
  });
});
