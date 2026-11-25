import { useEffect, useState } from "react";
import { AccountPanel } from "@/components/AccountPanel";
import { BoardBar } from "@/components/BoardBar";
import { KanbanBoard } from "@/components/KanbanBoard";
import { createBoard, deleteBoard, listBoards, renameBoard, type BoardSummary } from "@/lib/api";

const CURRENT_BOARD_KEY = "pm-current-board";

type WorkspaceProps = {
  username: string;
  onLogout: () => void;
  onAccountDeleted: () => void;
};

// The signed-in app: the user's boards, the open board and the account panel
export const Workspace = ({ username, onLogout, onAccountDeleted }: WorkspaceProps) => {
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  const select = (id: number) => {
    setCurrentId(id);
    setError("");
    localStorage.setItem(CURRENT_BOARD_KEY, String(id));
  };

  useEffect(() => {
    listBoards().then((loaded) => {
      setBoards(loaded);
      // Reopen the last board, if it still exists
      const remembered = Number(localStorage.getItem(CURRENT_BOARD_KEY));
      select(loaded.some((board) => board.id === remembered) ? remembered : loaded[0].id);
    });
  }, []);

  if (!boards || currentId === null) {
    return null;
  }

  const handleCreate = async (name: string) => {
    const created = await createBoard(name);
    setBoards([...boards, created]);
    select(created.id);
  };

  const handleRename = async (name: string) => {
    const renamed = await renameBoard(currentId, name);
    setBoards(boards.map((board) => (board.id === renamed.id ? renamed : board)));
  };

  const handleDelete = async () => {
    const deleteError = await deleteBoard(currentId);
    if (deleteError) {
      setError(deleteError);
      return;
    }
    const remaining = boards.filter((board) => board.id !== currentId);
    setBoards(remaining);
    select(remaining[0].id);
  };

  return (
    <>
      <KanbanBoard
        key={currentId}
        boardId={currentId}
        onLogout={onLogout}
        toolbar={
          <BoardBar
            boards={boards}
            currentId={currentId}
            error={error}
            onSelect={select}
            onCreate={handleCreate}
            onRename={handleRename}
            onDelete={handleDelete}
            onAccount={() => setIsAccountOpen(true)}
          />
        }
      />
      {isAccountOpen && (
        <AccountPanel
          username={username}
          onClose={() => setIsAccountOpen(false)}
          onDeleted={onAccountDeleted}
        />
      )}
    </>
  );
};
