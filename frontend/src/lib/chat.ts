import { errorMessage, savesDone } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  reply: string;
  board: BoardData | null;
};

const HISTORY_PREFIX = "pm-chat-history-";

// sessionStorage, one conversation per board: survives a reload, cleared on logout
export const loadHistory = (boardId: number): ChatMessage[] =>
  JSON.parse(sessionStorage.getItem(HISTORY_PREFIX + boardId) ?? "[]");

export const saveHistory = (boardId: number, history: ChatMessage[]) => {
  sessionStorage.setItem(HISTORY_PREFIX + boardId, JSON.stringify(history));
};

export const clearHistory = () => {
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith(HISTORY_PREFIX))
    .forEach((key) => sessionStorage.removeItem(key));
};

export const sendChat = async (
  boardId: number,
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> => {
  // The AI works on the stored board, so let the latest edits reach it first
  await savesDone();
  const response = await fetch(`/api/boards/${boardId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Something went wrong. Please try again."));
  }
  return response.json();
};
