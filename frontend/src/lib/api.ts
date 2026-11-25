import type { BoardData } from "@/lib/kanban";

export const getBoard = async (): Promise<BoardData> => {
  const response = await fetch("/api/board");
  return response.json();
};

// Saves run one at a time, in order, so an older board never overwrites a newer one
let pendingSaves: Promise<unknown> = Promise.resolve();

// Resolves when every save started so far has finished
export const savesDone = () => pendingSaves;

// Returns false when the session has ended (401), so the caller can return to sign in
export const saveBoard = (board: BoardData): Promise<boolean> => {
  const result = pendingSaves.then(async () => {
    const response = await fetch("/api/board", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(board),
    });
    return response.status !== 401;
  });
  // A failed save must not block the ones after it
  pendingSaves = result.catch(() => {});
  return result;
};
