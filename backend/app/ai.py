import os
from datetime import date
from typing import Literal

from openai import LengthFinishReasonError, OpenAI, OpenAIError
from pydantic import BaseModel, ValidationError

from app.models import Board, Priority

BASE_URL = "https://openrouter.ai/api/v1"
MODEL = "openai/gpt-oss-120b"
TIMEOUT_SECONDS = 60
# Only the most recent messages are sent, so cost and context size stay bounded
HISTORY_LIMIT = 20

SYSTEM_PROMPT = """You are the assistant inside a Kanban board app. You help the user manage their board.

The current board is below as JSON. Columns are in display order; each column lists its card ids in order.

You may create, edit, move, reorder and delete cards. You must not add, remove, rename or reorder columns.

Reply with:
- reply: your message to the user, as plain text. The app does not render Markdown, so never use asterisks, underscores, backticks or # headings. Use line breaks and "- " for lists. Refer to cards by title, never by id.
- board: null if the board should not change. Otherwise the complete updated board, with every column \
(same ids, titles and order as now) and every card that should remain. Each card must appear in exactly one \
column's cardIds. New cards need a new unique id like "card-<short-random-text>".

Each card has: title; details; priority ("low", "medium", "high" or null); dueDate ("YYYY-MM-DD" or null); \
labels (a list of short words, at most 8, each up to 24 characters); checklist (up to 20 items, each \
{{id, text, done}}; new items need a new unique id like "item-<short-random-text>"). Keep fields you are not asked to change.

Today is {today}.

Current board:
"""


class AIError(Exception):
    pass


class AIChecklistItem(BaseModel):
    id: str
    text: str
    done: bool


class AICard(BaseModel):
    # Every field required and no defaults: strict structured outputs need that.
    # Values are checked when converted to a Card in apply_update
    id: str
    title: str
    details: str
    priority: Priority | None
    dueDate: str | None
    labels: list[str]
    checklist: list[AIChecklistItem]


class AIColumn(BaseModel):
    # Plain fields only (no length limits); checked when converted to a Board
    id: str
    title: str
    cardIds: list[str]


class AIBoard(BaseModel):
    # Cards as a list: strict structured outputs do not allow free-form maps
    columns: list[AIColumn]
    cards: list[AICard]


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
    # A missing key raises OpenAIError when the client is created.
    # Short timeout: the board is locked while waiting (SDK default is 600s with 2 retries)
    return OpenAI(
        base_url=BASE_URL,
        api_key=os.environ.get("OPENROUTER_API_KEY"),
        timeout=TIMEOUT_SECONDS,
        max_retries=1,
    )


def ask(prompt: str) -> str:
    response = client().chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        extra_body={"models": models()},
    )
    return response.choices[0].message.content


def chat(board: Board, history: list[Message], message: str) -> ChatResult:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(today=date.today().isoformat()) + board.model_dump_json()},
        *(m.model_dump() for m in history[-HISTORY_LIMIT:]),
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
    except OpenAIError as error:
        # Network errors, timeouts, rate limits, a bad or missing API key
        raise AIError("The AI service is unavailable. Please try again.") from error
    result = response.choices[0].message.parsed
    if result is None:
        # The model refused instead of answering
        raise AIError("The AI could not answer that. Please try rephrasing.")
    return result


def apply_update(current: Board, proposed: AIBoard) -> Board:
    columns = [(c.id, c.title) for c in proposed.columns]
    if columns != [(c.id, c.title) for c in current.columns]:
        raise AIError("The AI tried to change the columns, so the update was not applied")

    if len({card.id for card in proposed.cards}) != len(proposed.cards):
        raise AIError("The AI returned the same card twice, so the update was not applied")
    try:
        # Board checks the card fields and that every card is in exactly one column
        return Board.model_validate(
            {"columns": proposed.model_dump()["columns"], "cards": {card.id: card.model_dump() for card in proposed.cards}}
        )
    except ValidationError as error:
        raise AIError("The AI returned an invalid board, so the update was not applied") from error
