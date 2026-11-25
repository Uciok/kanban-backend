import type { BoardData } from "@/lib/kanban";

// Same as backend/app/default_board.json
export const defaultBoard: BoardData = {
  "columns": [
    {
      "id": "col-backlog",
      "title": "Backlog",
      "cardIds": [
        "card-1",
        "card-2"
      ]
    },
    {
      "id": "col-discovery",
      "title": "Discovery",
      "cardIds": [
        "card-3"
      ]
    },
    {
      "id": "col-progress",
      "title": "In Progress",
      "cardIds": [
        "card-4",
        "card-5"
      ]
    },
    {
      "id": "col-review",
      "title": "Review",
      "cardIds": [
        "card-6"
      ]
    },
    {
      "id": "col-done",
      "title": "Done",
      "cardIds": [
        "card-7",
        "card-8"
      ]
    }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Align roadmap themes",
      "details": "Draft quarterly themes with impact statements and metrics.",
      "priority": "high",
      "dueDate": null,
      "labels": [
        "planning"
      ],
      "checklist": [
        {
          "id": "item-1",
          "text": "Collect input from team leads",
          "done": true
        },
        {
          "id": "item-2",
          "text": "Draft three themes",
          "done": false
        },
        {
          "id": "item-3",
          "text": "Review with leadership",
          "done": false
        }
      ]
    },
    "card-2": {
      "id": "card-2",
      "title": "Gather customer signals",
      "details": "Review support tags, sales notes, and churn feedback.",
      "priority": "medium",
      "dueDate": null,
      "labels": [
        "research"
      ],
      "checklist": []
    },
    "card-3": {
      "id": "card-3",
      "title": "Prototype analytics view",
      "details": "Sketch initial dashboard layout and key drill-downs.",
      "priority": null,
      "dueDate": null,
      "labels": [
        "design"
      ],
      "checklist": []
    },
    "card-4": {
      "id": "card-4",
      "title": "Refine status language",
      "details": "Standardize column labels and tone across the board.",
      "priority": "low",
      "dueDate": null,
      "labels": [],
      "checklist": []
    },
    "card-5": {
      "id": "card-5",
      "title": "Design card layout",
      "details": "Add hierarchy and spacing for scanning dense lists.",
      "priority": "medium",
      "dueDate": null,
      "labels": [
        "design"
      ],
      "checklist": []
    },
    "card-6": {
      "id": "card-6",
      "title": "QA micro-interactions",
      "details": "Verify hover, focus, and loading states.",
      "priority": "high",
      "dueDate": null,
      "labels": [
        "qa"
      ],
      "checklist": []
    },
    "card-7": {
      "id": "card-7",
      "title": "Ship marketing page",
      "details": "Final copy approved and asset pack delivered.",
      "priority": null,
      "dueDate": null,
      "labels": [
        "marketing"
      ],
      "checklist": []
    },
    "card-8": {
      "id": "card-8",
      "title": "Close onboarding sprint",
      "details": "Document release notes and share internally.",
      "priority": null,
      "dueDate": null,
      "labels": [],
      "checklist": []
    }
  }
};

export const cloneBoard = (): BoardData => structuredClone(defaultBoard);
