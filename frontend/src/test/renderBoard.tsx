import { render, screen } from "@testing-library/react";
import { KanbanBoard } from "@/components/KanbanBoard";

// Renders board 1 and waits for it to load
export const renderBoard = async () => {
  const view = render(<KanbanBoard boardId={1} onLogout={() => {}} />);
  await screen.findByRole("heading", { name: "Kanban Studio" });
  return view;
};
