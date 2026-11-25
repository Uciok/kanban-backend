import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, StringConstraints
from starlette.middleware.sessions import SessionMiddleware

from app import activity, ai, db
from app.models import Board

STATIC_DIR = Path(__file__).parent.parent / "static"
# Demo account, created on startup
DEMO_USERNAME = "user"
DEMO_PASSWORD = "password"

Username = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_.-]{3,32}$")]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]
BoardName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db(DEMO_USERNAME, DEMO_PASSWORD)
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SESSION_SECRET") or secrets.token_hex(32),
)


class Credentials(BaseModel):
    username: str
    password: str


class Registration(BaseModel):
    username: Username
    password: Password


class PasswordChange(BaseModel):
    current_password: str
    new_password: Password


class PasswordConfirmation(BaseModel):
    password: str


class BoardNameRequest(BaseModel):
    name: BoardName


class BoardSummary(BaseModel):
    id: int
    name: str
    updated_at: str


class BoardDetail(BaseModel):
    id: int
    name: str
    board: Board


class ActivityEvent(BaseModel):
    id: int
    summary: str
    created_at: str
    username: str


class ChatRequest(BaseModel):
    message: str
    history: list[ai.Message] = []


class ChatResponse(BaseModel):
    reply: str
    board: Board | None


def current_user(request: Request) -> int:
    user_id = request.session.get("user_id")
    if user_id is None or db.get_username(user_id) is None:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Not signed in")
    return user_id


UserId = Annotated[int, Depends(current_user)]


def sign_in(request: Request, user_id: int, username: str) -> dict:
    request.session.clear()
    request.session["user_id"] = user_id
    return {"username": username}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Auth


@app.post("/api/auth/register", status_code=201)
def register(registration: Registration, request: Request):
    user_id = db.create_user(registration.username, registration.password)
    if user_id is None:
        raise HTTPException(status_code=409, detail="That username is taken")
    return sign_in(request, user_id, registration.username)


@app.post("/api/auth/login")
def login(credentials: Credentials, request: Request):
    user_id = db.authenticate(credentials.username, credentials.password)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return sign_in(request, user_id, credentials.username)


@app.post("/api/auth/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@app.get("/api/auth/me")
def me(user_id: UserId):
    return {"username": db.get_username(user_id)}


@app.post("/api/auth/password", status_code=204)
def change_password(change: PasswordChange, user_id: UserId):
    if not db.check_user_password(user_id, change.current_password):
        raise HTTPException(status_code=403, detail="Current password is incorrect")
    db.set_password(user_id, change.new_password)
    return Response(status_code=204)


@app.delete("/api/auth/me", status_code=204)
def delete_account(confirmation: PasswordConfirmation, user_id: UserId, request: Request):
    if not db.check_user_password(user_id, confirmation.password):
        raise HTTPException(status_code=403, detail="Password is incorrect")
    db.delete_user(user_id)
    request.session.clear()
    return Response(status_code=204)


# Boards


def board_or_404(user_id: int, board_id: int) -> dict:
    found = db.get_board(user_id, board_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return found


def stored_board(user_id: int, board_id: int) -> Board:
    return Board.model_validate(board_or_404(user_id, board_id)["board"])


@app.get("/api/boards")
def list_boards(user_id: UserId) -> list[BoardSummary]:
    return db.list_boards(user_id)


@app.post("/api/boards", status_code=201)
def create_board(new: BoardNameRequest, user_id: UserId) -> BoardSummary:
    created = db.create_board(user_id, new.name)
    db.add_events(user_id, created["id"], ["Created the board"])
    return created


@app.get("/api/boards/{board_id}")
def read_board(board_id: int, user_id: UserId) -> BoardDetail:
    return board_or_404(user_id, board_id)


@app.put("/api/boards/{board_id}")
def write_board(board_id: int, board: Board, user_id: UserId) -> Board:
    stored = stored_board(user_id, board_id)
    db.save_board(user_id, board_id, board.model_dump(), activity.describe_changes(stored, board))
    return board


@app.patch("/api/boards/{board_id}")
def rename_board(board_id: int, rename: BoardNameRequest, user_id: UserId) -> BoardSummary:
    old_name = board_or_404(user_id, board_id)["name"]
    renamed = db.rename_board(user_id, board_id, rename.name)
    if rename.name != old_name:
        db.add_events(user_id, board_id, [f'Renamed the board to "{rename.name}"'])
    return renamed


@app.delete("/api/boards/{board_id}", status_code=204)
def delete_board(board_id: int, user_id: UserId):
    board_or_404(user_id, board_id)
    if db.count_boards(user_id) == 1:
        raise HTTPException(status_code=409, detail="You cannot delete your only board")
    db.delete_board(user_id, board_id)
    return Response(status_code=204)


@app.get("/api/boards/{board_id}/activity")
def board_activity(board_id: int, user_id: UserId) -> list[ActivityEvent]:
    board_or_404(user_id, board_id)
    return db.list_events(user_id, board_id)


# AI


@app.post("/api/ai/test")
def ai_test(user_id: UserId):
    return {"answer": ai.ask("What is 2+2? Reply with just the number.")}


@app.post("/api/boards/{board_id}/chat")
def chat(board_id: int, request: ChatRequest, user_id: UserId) -> ChatResponse:
    board = stored_board(user_id, board_id)
    try:
        result = ai.chat(board, request.history, request.message)
        if result.board is None:
            return ChatResponse(reply=result.reply, board=None)
        updated = ai.apply_update(board, result.board)
    except ai.AIError as error:
        raise HTTPException(status_code=502, detail=str(error))
    summaries = [f"AI: {summary}" for summary in activity.describe_changes(board, updated)]
    db.save_board(user_id, board_id, updated.model_dump(), summaries)
    return ChatResponse(reply=result.reply, board=updated)


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True, check_dir=False), name="static")
