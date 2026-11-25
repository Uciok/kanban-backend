import type { BoardData } from "@/lib/kanban";
import { cloneBoard } from "@/test/board";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

// Stubs fetch with an in-memory version of the backend API
export const fakeBackend = ({ signedIn = true } = {}) => {
  let session = signedIn;
  let board: BoardData = cloneBoard();
  const saves: BoardData[] = [];

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
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
    if (url === "/api/board" && method === "GET") {
      return jsonResponse(200, board);
    }
    if (url === "/api/board" && method === "PUT") {
      board = JSON.parse(init!.body as string);
      saves.push(board);
      return jsonResponse(200, board);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  return { saves, savedBoard: () => board };
};
