from datetime import date
from typing import Annotated, Literal, Self

from pydantic import AfterValidator, BaseModel, Field, StringConstraints, model_validator

Priority = Literal["low", "medium", "high"]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=24)]


def check_date(value: str) -> str:
    # Stored as "YYYY-MM-DD"; must be a real date
    date.fromisoformat(value)
    if len(value) != 10:
        raise ValueError("Dates must be YYYY-MM-DD")
    return value


IsoDate = Annotated[str, AfterValidator(check_date)]


class ChecklistItem(BaseModel):
    id: str
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    done: bool = False


class Card(BaseModel):
    id: str
    title: str
    details: str
    # Optional fields; boards saved before they existed load with these defaults
    priority: Priority | None = None
    dueDate: IsoDate | None = None
    labels: list[Label] = Field(default_factory=list, max_length=8)
    checklist: list[ChecklistItem] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def check_checklist_ids(self) -> Self:
        if len({item.id for item in self.checklist}) != len(self.checklist):
            raise ValueError("Checklist item ids must be unique")
        return self


ColumnTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class Column(BaseModel):
    id: str
    title: ColumnTitle
    cardIds: list[str]


class Board(BaseModel):
    columns: list[Column] = Field(min_length=1, max_length=12)
    cards: dict[str, Card]

    @model_validator(mode="after")
    def check_cards(self) -> Self:
        if len({column.id for column in self.columns}) != len(self.columns):
            raise ValueError("Column ids must be unique")
        # Every card is in exactly one column, and every listed card exists
        card_ids = [card_id for column in self.columns for card_id in column.cardIds]
        if len(set(card_ids)) != len(card_ids):
            raise ValueError("A card is listed more than once")
        if set(card_ids) != set(self.cards):
            raise ValueError("The cards do not match the columns")
        if any(key != card.id for key, card in self.cards.items()):
            raise ValueError("Card keys must match card ids")
        return self
