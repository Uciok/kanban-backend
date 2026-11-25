import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/components/App";
import { fakeBackend } from "@/test/fakeBackend";

const signIn = async (username: string, password: string) => {
  await userEvent.type(await screen.findByLabelText("Username"), username);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("shows the login form when signed out", async () => {
    fakeBackend({ signedIn: false });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();
  });

  it("shows the board when a session exists", async () => {
    fakeBackend();
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
  });

  it("signs in with valid credentials", async () => {
    fakeBackend({ signedIn: false });
    render(<App />);
    await signIn("user", "password");
    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
  });

  it("shows an error for invalid credentials", async () => {
    fakeBackend({ signedIn: false });
    render(<App />);
    await signIn("user", "wrong");
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password");
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();
  });

  it("logs out back to the login form", async () => {
    fakeBackend();
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("keeps board changes after logging out and back in", async () => {
    fakeBackend({ signedIn: false });
    render(<App />);
    await signIn("user", "password");
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete Prototype analytics view" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    await signIn("user", "password");

    await screen.findByRole("heading", { name: "Kanban Studio" });
    expect(screen.queryByText("Prototype analytics view")).not.toBeInTheDocument();
  });

  it("returns to the login form when a save finds the session has ended", async () => {
    const backend = fakeBackend();
    render(<App />);
    await screen.findByRole("heading", { name: "Kanban Studio" });
    backend.endSession();

    await userEvent.click(screen.getByRole("button", { name: "Delete Prototype analytics view" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("clears the chat history on logout", async () => {
    sessionStorage.setItem(
      "pm-chat-history",
      JSON.stringify([{ role: "user", content: "Old question" }])
    );
    fakeBackend();
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Log out" }));
    await screen.findByRole("heading", { name: "Sign in" });
    expect(sessionStorage.getItem("pm-chat-history")).toBeNull();
  });
});
