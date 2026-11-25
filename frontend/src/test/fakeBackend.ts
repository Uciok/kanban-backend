import type { BoardData } from "@/lib/kanban";
import type { ChatMessage } from "@/lib/chat";
import { cloneBoard } from "@/test/board";

export const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

type ChatRequest = { boardId: number; message: string; history: ChatMessage[] };
type ChatHandler = (request: ChatRequest) => Promise<Response> | Response;
type StoredBoard = { id: number; name: string; board: BoardData };

const emptyBoard = (): BoardData => ({
  columns: cloneBoard().columns.map((column) => ({ ...column, cardIds: [] })),
  cards: {},
});

// Stubs fetch with an in-memory version of the backend API.
// The demo user `user` / `password` starts with one board, "My board" (id 1).
// `chat` decides the chat response; by default the AI replies without changing the board.
export const fakeBackend = ({
  signedIn = true,
  chat = (() => jsonResponse(200, { reply: "Hi", board: null })) as ChatHandler,
} = {}) => {
  const passwords: Record<string, string> = { user: "password" };
  const boardsByUser: Record<string, StoredBoard[]> = {
    user: [{ id: 1, name: "My board", board: cloneBoard() }],
  };
  let session: string | null = signedIn ? "user" : null;
  let nextBoardId = 2;
  // Board contents sent by each save, and which board each went to
  const saves: BoardData[] = [];
  const saveLog: { id: number; board: BoardData }[] = [];
  const chatRequests: ChatRequest[] = [];
  // Activity per board id; tests add events directly
  const activity: Record<number, { id: number; summary: string; created_at: string; username: string }[]> = {};

  const summary = ({ id, name }: StoredBoard) => ({ id, name, updated_at: "2026-11-25 10:00:00" });
  const ownBoard = (id: number) => boardsByUser[session!].find((board) => board.id === id);

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body as string) : {};

    if (url === "/api/auth/login") {
      if (passwords[body.username] !== body.password) {
        return jsonResponse(401, { detail: "Invalid username or password" });
      }
      session = body.username;
      return jsonResponse(200, { username: body.username });
    }
    if (url === "/api/auth/register") {
      if (body.username.length < 3 || body.password.length < 8) {
        return jsonResponse(422, { detail: [] });
      }
      if (body.username in passwords) {
        return jsonResponse(409, { detail: "That username is taken" });
      }
      passwords[body.username] = body.password;
      boardsByUser[body.username] = [{ id: nextBoardId++, name: "My board", board: cloneBoard() }];
      session = body.username;
      return jsonResponse(201, { username: body.username });
    }
    if (url === "/api/auth/logout") {
      session = null;
      return jsonResponse(200, {});
    }
    if (!session) {
      return jsonResponse(401, { detail: "Not signed in" });
    }
    if (url === "/api/auth/me" && method === "GET") {
      return jsonResponse(200, { username: session });
    }
    if (url === "/api/auth/password") {
      if (passwords[session] !== body.current_password) {
        return jsonResponse(403, { detail: "Current password is incorrect" });
      }
      if (body.new_password.length < 8) {
        return jsonResponse(422, { detail: [] });
      }
      passwords[session] = body.new_password;
      return new Response(null, { status: 204 });
    }
    if (url === "/api/auth/me" && method === "DELETE") {
      if (passwords[session] !== body.password) {
        return jsonResponse(403, { detail: "Password is incorrect" });
      }
      delete passwords[session];
      delete boardsByUser[session];
      session = null;
      return new Response(null, { status: 204 });
    }
    if (url === "/api/boards" && method === "GET") {
      return jsonResponse(200, boardsByUser[session].map(summary));
    }
    if (url === "/api/boards" && method === "POST") {
      const created = { id: nextBoardId++, name: body.name, board: emptyBoard() };
      boardsByUser[session].push(created);
      return jsonResponse(201, summary(created));
    }

    const match = url.match(/^\/api\/boards\/(\d+)(\/chat)?$/);
    const stored = match ? ownBoard(Number(match[1])) : undefined;
    if (match && !stored) {
      return jsonResponse(404, { detail: "Board not found" });
    }
    if (url.endsWith("/activity")) {
      const id = Number(url.split("/")[3]);
      return ownBoard(id) ? jsonResponse(200, activity[id] ?? []) : jsonResponse(404, { detail: "Board not found" });
    }
    if (stored && match![2]) {
      const request = { boardId: stored.id, ...body };
      chatRequests.push(request);
      return chat(request);
    }
    if (stored && method === "GET") {
      return jsonResponse(200, stored);
    }
    if (stored && method === "PUT") {
      stored.board = body;
      saves.push(body);
      saveLog.push({ id: stored.id, board: body });
      return jsonResponse(200, body);
    }
    if (stored && method === "PATCH") {
      stored.name = body.name;
      return jsonResponse(200, summary(stored));
    }
    if (stored && method === "DELETE") {
      if (boardsByUser[session].length === 1) {
        return jsonResponse(409, { detail: "You cannot delete your only board" });
      }
      boardsByUser[session] = boardsByUser[session].filter((board) => board.id !== stored.id);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    saves,
    saveLog,
    chatRequests,
    activity,
    savedBoard: (id = 1) => Object.values(boardsByUser).flat().find((board) => board.id === id)!.board,
    boards: () => (session ? boardsByUser[session] : []),
    passwordOf: (username: string) => passwords[username],
    // Simulates the session ending on the server, e.g. after a restart
    endSession: () => {
      session = null;
    },
  };
};
