import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { cloneBoard } from "@/test/board";
import { fakeBackend, jsonResponse } from "@/test/fakeBackend";

const renderBoard = async () => {
  const view = render(<KanbanBoard onLogout={() => {}} />);
  await screen.findByRole("heading", { name: "Kanban Studio" });
  return view;
};

const openChat = () => userEvent.click(screen.getByRole("button", { name: "AI chat" }));

const send = async (text: string) => {
  await userEvent.type(screen.getByLabelText("Message"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("ChatSidebar", () => {
  it("is closed by default and opens and closes", async () => {
    fakeBackend();
    await renderBoard();
    expect(screen.queryByRole("complementary", { name: "AI chat" })).not.toBeInTheDocument();

    await openChat();
    expect(screen.getByRole("complementary", { name: "AI chat" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary", { name: "AI chat" })).not.toBeInTheDocument();
  });

  it("shows the reply and sends the history with the next message", async () => {
    const backend = fakeBackend({
      chat: ({ message }) => jsonResponse(200, { reply: `You said: ${message}`, board: null }),
    });
    await renderBoard();
    await openChat();

    await send("First");
    expect(await screen.findByText("You said: First")).toBeInTheDocument();
    await send("Second");
    expect(await screen.findByText("You said: Second")).toBeInTheDocument();

    expect(backend.chatRequests[0]).toEqual({ message: "First", history: [] });
    expect(backend.chatRequests[1]).toEqual({
      message: "Second",
      history: [
        { role: "user", content: "First" },
        { role: "assistant", content: "You said: First" },
      ],
    });
  });

  it("refreshes the board when the AI changes it", async () => {
    const updated = cloneBoard();
    updated.cards["card-ai"] = { id: "card-ai", title: "Made by AI", details: "From chat" };
    updated.columns[1].cardIds.push("card-ai");
    const backend = fakeBackend({
      chat: () => jsonResponse(200, { reply: "Added it", board: updated }),
    });
    await renderBoard();
    await openChat();

    await send("Add a card");

    const discovery = screen.getByTestId("column-col-discovery");
    expect(await within(discovery).findByText("Made by AI")).toBeInTheDocument();
    // The backend saves AI updates itself
    expect(backend.saves).toHaveLength(0);
  });

  it("locks the board and Send while waiting for the AI", async () => {
    let respond: (response: Response) => void = () => {};
    fakeBackend({ chat: () => new Promise<Response>((resolve) => (respond = resolve)) });
    await renderBoard();
    await openChat();

    await send("Slow question");
    expect(screen.getByTestId("board")).toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByText("Thinking...")).toBeInTheDocument();

    respond(jsonResponse(200, { reply: "Done", board: null }));
    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(screen.getByTestId("board")).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("shows the error and puts the message back on failure", async () => {
    fakeBackend({
      chat: () => jsonResponse(502, { detail: "The AI tried to change the columns" }),
    });
    await renderBoard();
    await openChat();

    await send("Rename a column");

    expect(await screen.findByText("The AI tried to change the columns")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("Rename a column");
    expect(screen.queryByTestId("chat-user")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("pm-chat-history")).toBeNull();
  });

  it("shows a readable error when the server error is not JSON", async () => {
    fakeBackend({
      chat: () => new Response("Internal Server Error", { status: 500 }),
    });
    await renderBoard();
    await openChat();

    await send("Hello");

    expect(
      await screen.findByText("Something went wrong. Please try again.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("Hello");
  });

  it("keeps the conversation after a reload", async () => {
    fakeBackend();
    const view = await renderBoard();
    await openChat();
    await send("Remember me");
    await screen.findByText("Hi");
    view.unmount();

    await renderBoard();
    await openChat();
    expect(screen.getByText("Remember me")).toBeInTheDocument();
    expect(screen.getByText("Hi")).toBeInTheDocument();
  });
});
