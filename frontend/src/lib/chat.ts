import type { BoardData } from "@/lib/kanban";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  reply: string;
  board: BoardData | null;
};

const HISTORY_KEY = "pm-chat-history";

// sessionStorage: survives a reload, cleared on logout
export const loadHistory = (): ChatMessage[] =>
  JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? "[]");

export const saveHistory = (history: ChatMessage[]) => {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

export const clearHistory = () => {
  sessionStorage.removeItem(HISTORY_KEY);
};

export const sendChat = async (
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail ?? "Something went wrong. Please try again.");
  }
  return data;
};
