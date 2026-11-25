import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/components/App";
import { fakeBackend } from "@/test/fakeBackend";

const fillCredentials = async (username: string, password: string) => {
  await userEvent.type(await screen.findByLabelText("Username"), username);
  await userEvent.type(screen.getByLabelText("Password"), password);
};

const openAccount = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Account" }));
  return screen.getByRole("dialog", { name: "Account" });
};

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("Sign up", () => {
  it("creates an account and opens its board", async () => {
    const backend = fakeBackend({ signedIn: false });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Create an account" }));
    expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument();

    await fillCredentials("alice", "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    expect(backend.passwordOf("alice")).toBe("secret-pass");
  });

  it("shows an error when the username is taken", async () => {
    fakeBackend({ signedIn: false });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Create an account" }));
    await fillCredentials("user", "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That username is taken");
  });

  it("explains the rules for an invalid username or password", async () => {
    fakeBackend({ signedIn: false });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Create an account" }));
    await fillCredentials("bob", "short");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at least 8 characters");
  });

  it("switches back to sign in and clears the error", async () => {
    fakeBackend({ signedIn: false });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Create an account" }));
    await fillCredentials("user", "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Account panel", () => {
  it("shows who is signed in and closes", async () => {
    fakeBackend();
    render(<App />);
    const dialog = await openAccount();
    expect(dialog).toHaveTextContent("Signed in as user");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("changes the password", async () => {
    const backend = fakeBackend();
    render(<App />);
    await openAccount();
    await userEvent.type(screen.getByLabelText("Current password"), "password");
    await userEvent.type(screen.getByLabelText("New password"), "new-secret");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Password changed")).toBeInTheDocument();
    expect(backend.passwordOf("user")).toBe("new-secret");
    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });

  it("shows an error for a wrong current password", async () => {
    const backend = fakeBackend();
    render(<App />);
    await openAccount();
    await userEvent.type(screen.getByLabelText("Current password"), "wrong-one");
    await userEvent.type(screen.getByLabelText("New password"), "new-secret");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
    expect(backend.passwordOf("user")).toBe("password");
  });

  it("deletes the account and returns to sign in", async () => {
    sessionStorage.setItem("pm-chat-history-1", JSON.stringify([{ role: "user", content: "Hi" }]));
    const backend = fakeBackend();
    render(<App />);
    await openAccount();
    await userEvent.type(screen.getByLabelText("Password to confirm"), "password");
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(backend.passwordOf("user")).toBeUndefined();
    expect(sessionStorage.getItem("pm-chat-history-1")).toBeNull();
  });

  it("keeps the account when the password is wrong", async () => {
    const backend = fakeBackend();
    render(<App />);
    await openAccount();
    await userEvent.type(screen.getByLabelText("Password to confirm"), "wrong-one");
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(await screen.findByText("Password is incorrect")).toBeInTheDocument();
    expect(backend.passwordOf("user")).toBe("password");
  });
});
