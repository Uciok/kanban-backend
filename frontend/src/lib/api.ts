import type { BoardData } from "@/lib/kanban";

export type BoardSummary = { id: number; name: string; updated_at: string };
export type BoardDetail = { id: number; name: string; board: BoardData };
export type ActivityEvent = { id: number; summary: string; created_at: string; username: string };

export const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  return response.json();
};

// Reads the backend's error message; error bodies are not always JSON
export const errorMessage = async (response: Response, fallback: string) => {
  const data = await response.json().catch(() => ({}));
  return typeof data.detail === "string" ? data.detail : fallback;
};

// null when the request succeeded, otherwise the backend's error message
export const errorOrNull = async (response: Response, fallback: string): Promise<string | null> =>
  response.ok ? null : errorMessage(response, fallback);

export const listBoards = () => fetchJson<BoardSummary[]>("/api/boards");

export const createBoard = (name: string) =>
  fetchJson<BoardSummary>("/api/boards", jsonRequest("POST", { name }));

export const renameBoard = (id: number, name: string) =>
  fetchJson<BoardSummary>(`/api/boards/${id}`, jsonRequest("PATCH", { name }));

export const deleteBoard = async (id: number) => {
  const response = await fetch(`/api/boards/${id}`, { method: "DELETE" });
  return errorOrNull(response, "The board could not be deleted");
};

export const getBoard = (id: number) => fetchJson<BoardDetail>(`/api/boards/${id}`);

export const getActivity = (boardId: number) =>
  fetchJson<ActivityEvent[]>(`/api/boards/${boardId}/activity`);

// Saves run one at a time, in order, so an older board never overwrites a newer one
let pendingSaves: Promise<unknown> = Promise.resolve();

// Resolves when every save started so far has finished
export const savesDone = () => pendingSaves;

// Returns false when the session has ended (401), so the caller can return to sign in
export const saveBoard = (id: number, board: BoardData): Promise<boolean> => {
  const result = pendingSaves.then(async () => {
    const response = await fetch(`/api/boards/${id}`, jsonRequest("PUT", board));
    return response.status !== 401;
  });
  // A failed save must not block the ones after it
  pendingSaves = result.catch(() => {});
  return result;
};
