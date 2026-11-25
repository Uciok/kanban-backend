import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/components/App";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

// Fake backend: tracks whether the session is signed in
const mockBackend = (signedIn: boolean) => {
  let session = signedIn;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/auth/me") {
      return session ? jsonResponse(200, { username: "user" }) : jsonResponse(401, {});
    }
    if (url === "/api/auth/login") {
      const { username, password } = JSON.parse(init!.body as string);
      session = username === "user" && password === "password";
      return session ? jsonResponse(200, { username }) : jsonResponse(401, {});
    }
    if (url === "/api/auth/logout") {
      session = false;
      return jsonResponse(200, {});
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
};

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
    mockBackend(false);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();
  });

  it("shows the board when a session exists", async () => {
    mockBackend(true);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
  });

  it("signs in with valid credentials", async () => {
    mockBackend(false);
    render(<App />);
    await signIn("user", "password");
    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
  });

  it("shows an error for invalid credentials", async () => {
    mockBackend(false);
    render(<App />);
    await signIn("user", "wrong");
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password");
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();
  });

  it("logs out back to the login form", async () => {
    mockBackend(true);
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});
