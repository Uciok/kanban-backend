from app.models import Board

# More changes than this in one save are summarised as one event
MAX_EVENTS_PER_SAVE = 10


def describe_changes(old: Board, new: Board) -> list[str]:
    """Short, human readable summaries of what changed between two versions of a board."""
    events: list[str] = []
    old_columns = {column.id: column for column in old.columns}
    new_columns = {column.id: column for column in new.columns}

    for column in new.columns:
        if column.id not in old_columns:
            events.append(f'Added column "{column.title}"')
        elif old_columns[column.id].title != column.title:
            events.append(f'Renamed column "{old_columns[column.id].title}" to "{column.title}"')
    for column in old.columns:
        if column.id not in new_columns:
            events.append(f'Removed column "{column.title}"')
    kept_old = [column.id for column in old.columns if column.id in new_columns]
    kept_new = [column.id for column in new.columns if column.id in old_columns]
    if kept_old != kept_new:
        events.append("Reordered columns")

    old_home = {card_id: column for column in old.columns for card_id in column.cardIds}
    new_home = {card_id: column for column in new.columns for card_id in column.cardIds}
    for card_id, card in new.cards.items():
        before = old.cards.get(card_id)
        if before is None:
            events.append(f'Added card "{card.title}" to {new_home[card_id].title}')
            continue
        if old_home[card_id].id != new_home[card_id].id:
            events.append(f'Moved "{card.title}" from {old_home[card_id].title} to {new_home[card_id].title}')
        fields_changed = before.model_dump(exclude={"checklist"}) != card.model_dump(exclude={"checklist"})
        if fields_changed:
            events.append(f'Edited card "{card.title}"')
        elif before.checklist != card.checklist:
            events.append(f'Updated the checklist on "{card.title}"')
    for card_id, card in old.cards.items():
        if card_id not in new.cards:
            events.append(f'Deleted card "{card.title}"')

    if len(events) > MAX_EVENTS_PER_SAVE:
        return [f"Made {len(events)} changes"]
    return events
