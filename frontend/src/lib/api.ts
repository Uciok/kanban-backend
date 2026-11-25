import type { BoardData } from "@/lib/kanban";

export const getBoard = async (): Promise<BoardData> => {
  const response = await fetch("/api/board");
  return response.json();
};

// Returns false when the session has ended (401), so the caller can return to sign in
export const saveBoard = async (board: BoardData): Promise<boolean> => {
  const response = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });
  return response.status !== 401;
};
