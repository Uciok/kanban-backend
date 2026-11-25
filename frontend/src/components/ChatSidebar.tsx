import { useState, type FormEvent } from "react";
import clsx from "clsx";
import type { BoardData } from "@/lib/kanban";
import { loadHistory, saveHistory, sendChat, type ChatMessage } from "@/lib/chat";

type ChatSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  onBoardChange: (board: BoardData) => void;
  onBusyChange: (busy: boolean) => void;
};

export const ChatSidebar = ({
  isOpen,
  onClose,
  onBoardChange,
  onBusyChange,
}: ChatSidebarProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || isSending) {
      return;
    }

    setInput("");
    setError("");
    setMessages([...messages, { role: "user", content: message }]);
    setIsSending(true);
    onBusyChange(true);

    try {
      const { reply, board } = await sendChat(message, messages);
      const next: ChatMessage[] = [
        ...messages,
        { role: "user", content: message },
        { role: "assistant", content: reply },
      ];
      setMessages(next);
      saveHistory(next);
      if (board) {
        onBoardChange(board);
      }
    } catch (caught) {
      setMessages(messages);
      setInput(message);
      setError((caught as Error).message);
    } finally {
      setIsSending(false);
      onBusyChange(false);
    }
  };

  return (
    <aside
      hidden={!isOpen}
      className="fixed inset-y-0 right-0 z-20 flex w-full flex-col sm:max-w-[340px] border-l border-[var(--stroke)] bg-white shadow-[var(--shadow)]"
      aria-label="AI chat"
    >
      <header className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-5">
        <div>
          <div className="h-1 w-10 rounded-full bg-[var(--accent-yellow)]" />
          <h2 className="mt-3 font-display text-xl font-semibold text-[var(--navy-dark)]">
            AI assistant
          </h2>
          <p className="mt-1 text-xs text-[var(--gray-text)]">
            Ask about the board or have it create, edit and move cards.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
        >
          Close
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-5">
        {messages.length === 0 && (
          <p className="text-sm text-[var(--gray-text)]">
            Try: &quot;Add a card to Backlog for the client call&quot;.
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            data-testid={`chat-${message.role}`}
            className={clsx(
              "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6",
              message.role === "user"
                ? "self-end bg-[var(--primary-blue)] text-white"
                : "self-start bg-[var(--surface)] text-[var(--navy-dark)]"
            )}
          >
            {message.content}
          </div>
        ))}
        {isSending && (
          <p className="self-start text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Thinking...
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 border-t border-[var(--stroke)] px-6 py-5">
        {error && (
          <p className="text-sm font-semibold text-[var(--secondary-purple)]">{error}</p>
        )}
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          aria-label="Message"
          placeholder="Message the assistant"
          rows={3}
          className="w-full resize-none rounded-xl border border-[var(--stroke)] px-3 py-2 text-base sm:text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          disabled={isSending}
          className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </aside>
  );
};
