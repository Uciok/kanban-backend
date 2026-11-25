from typing import Self

from pydantic import BaseModel, model_validator


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class Board(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]

    @model_validator(mode="after")
    def check_cards(self) -> Self:
        # Every card is in exactly one column, and every listed card exists
        card_ids = [card_id for column in self.columns for card_id in column.cardIds]
        if len(set(card_ids)) != len(card_ids):
            raise ValueError("A card is listed more than once")
        if set(card_ids) != set(self.cards):
            raise ValueError("The cards do not match the columns")
        if any(key != card.id for key, card in self.cards.items()):
            raise ValueError("Card keys must match card ids")
        return self
