import type { BoardData } from "@/lib/kanban";

export type BoardSummary = { id: number; name: string; updated_at: string };
export type BoardDetail = { id: number; name: string; board: BoardData };

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// Reads the backend's error message; error bodies are not always JSON
export const errorMessage = async (response: Response, fallback: string) => {
  const data = await response.json().catch(() => ({}));
  return typeof data.detail === "string" ? data.detail : fallback;
};

export const listBoards = async (): Promise<BoardSummary[]> => {
  const response = await fetch("/api/boards");
  return response.json();
};

export const createBoard = async (name: string): Promise<BoardSummary> => {
  const response = await fetch("/api/boards", json("POST", { name }));
  return response.json();
};

export const renameBoard = async (id: number, name: string): Promise<BoardSummary> => {
  const response = await fetch(`/api/boards/${id}`, json("PATCH", { name }));
  return response.json();
};

// Returns an error message, or null on success
export const deleteBoard = async (id: number): Promise<string | null> => {
  const response = await fetch(`/api/boards/${id}`, { method: "DELETE" });
  return response.ok ? null : errorMessage(response, "The board could not be deleted");
};

export const getBoard = async (id: number): Promise<BoardDetail> => {
  const response = await fetch(`/api/boards/${id}`);
  return response.json();
};

// Saves run one at a time, in order, so an older board never overwrites a newer one
let pendingSaves: Promise<unknown> = Promise.resolve();

// Resolves when every save started so far has finished
export const savesDone = () => pendingSaves;

// Returns false when the session has ended (401), so the caller can return to sign in
export const saveBoard = (id: number, board: BoardData): Promise<boolean> => {
  const result = pendingSaves.then(async () => {
    const response = await fetch(`/api/boards/${id}`, json("PUT", board));
    return response.status !== 401;
  });
  // A failed save must not block the ones after it
  pendingSaves = result.catch(() => {});
  return result;
};

export type ActivityEvent = { id: number; summary: string; created_at: string; username: string };

export const getActivity = async (boardId: number): Promise<ActivityEvent[]> => {
  const response = await fetch(`/api/boards/${boardId}/activity`);
  return response.json();
};
