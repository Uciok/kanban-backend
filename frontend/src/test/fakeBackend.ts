import type { BoardData } from "@/lib/kanban";
import type { ChatMessage } from "@/lib/chat";
import { cloneBoard } from "@/test/board";

export const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

type ChatRequest = { message: string; history: ChatMessage[] };
type ChatHandler = (request: ChatRequest) => Promise<Response> | Response;

// Stubs fetch with an in-memory version of the backend API.
// `chat` decides the /api/chat response; by default the AI replies without changing the board.
export const fakeBackend = ({
  signedIn = true,
  chat = (() => jsonResponse(200, { reply: "Hi", board: null })) as ChatHandler,
} = {}) => {
  let session = signedIn;
  let board: BoardData = cloneBoard();
  const saves: BoardData[] = [];
  const chatRequests: ChatRequest[] = [];

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
    if (url === "/api/board" && !session) {
      return jsonResponse(401, { detail: "Not signed in" });
    }
    if (url === "/api/board" && method === "GET") {
      return jsonResponse(200, board);
    }
    if (url === "/api/board" && method === "PUT") {
      board = JSON.parse(init!.body as string);
      saves.push(board);
      return jsonResponse(200, board);
    }
    if (url === "/api/chat") {
      const request = JSON.parse(init!.body as string);
      chatRequests.push(request);
      return chat(request);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    saves,
    chatRequests,
    savedBoard: () => board,
    // Simulates the session ending on the server, e.g. after a restart
    endSession: () => {
      session = false;
    },
  };
};
