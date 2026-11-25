import os
from typing import Literal

from openai import LengthFinishReasonError, OpenAI
from pydantic import BaseModel, ValidationError

from app.models import Board, Card, Column

BASE_URL = "https://openrouter.ai/api/v1"
MODEL = "openai/gpt-oss-120b"

SYSTEM_PROMPT = """You are the assistant inside a Kanban board app. You help the user manage their board.

The current board is below as JSON. Columns are in display order; each column lists its card ids in order.

You may create, edit, move, reorder and delete cards. You must not add, remove, rename or reorder columns.

Reply with:
- reply: your message to the user
- board: null if the board should not change. Otherwise the complete updated board, with every column \
(same ids, titles and order as now) and every card that should remain. Each card must appear in exactly one \
column's cardIds. New cards need a new unique id like "card-<short-random-text>".

Current board:
"""


class AIError(Exception):
    pass


class AIBoard(BaseModel):
    # Cards as a list: strict structured outputs do not allow free-form maps
    columns: list[Column]
    cards: list[Card]


class ChatResult(BaseModel):
    reply: str
    board: AIBoard | None


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


def models() -> list[str]:
    # OpenRouter tries these in order if a model is unavailable
    fallbacks = os.environ.get("OPENROUTER_FALLBACK_MODELS", "")
    return [MODEL, *(m.strip() for m in fallbacks.split(",") if m.strip())]


def client() -> OpenAI:
    return OpenAI(base_url=BASE_URL, api_key=os.environ["OPENROUTER_API_KEY"])


def ask(prompt: str) -> str:
    response = client().chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        extra_body={"models": models()},
    )
    return response.choices[0].message.content


def chat(board: Board, history: list[Message], message: str) -> ChatResult:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + board.model_dump_json()},
        *(m.model_dump() for m in history),
        {"role": "user", "content": message},
    ]
    try:
        response = client().chat.completions.parse(
            model=MODEL,
            messages=messages,
            response_format=ChatResult,
            # Only route to providers that support structured outputs
            extra_body={"models": models(), "provider": {"require_parameters": True}},
        )
    except (ValidationError, LengthFinishReasonError) as error:
        raise AIError("The AI returned a response that could not be read") from error
    return response.choices[0].message.parsed


def apply_update(current: Board, proposed: AIBoard) -> Board:
    columns = [(c.id, c.title) for c in proposed.columns]
    if columns != [(c.id, c.title) for c in current.columns]:
        raise AIError("The AI tried to change the columns, so the update was not applied")

    card_ids = [card_id for column in proposed.columns for card_id in column.cardIds]
    if sorted(card_ids) != sorted(card.id for card in proposed.cards) or len(set(card_ids)) != len(card_ids):
        raise AIError("The AI returned cards that do not match the columns, so the update was not applied")

    return Board(columns=proposed.columns, cards={card.id: card for card in proposed.cards})
