import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from app import ai, db
from app.models import Board

STATIC_DIR = Path(__file__).parent.parent / "static"
USERNAME = "user"
PASSWORD = "password"


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db(USERNAME)
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SESSION_SECRET") or secrets.token_hex(32),
)


class Credentials(BaseModel):
    username: str
    password: str


class ChatRequest(BaseModel):
    message: str
    history: list[ai.Message] = []


class ChatResponse(BaseModel):
    reply: str
    board: Board | None


def current_user(request: Request) -> str:
    username = request.session.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Not signed in")
    return username


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/login")
def login(credentials: Credentials, request: Request):
    if credentials.username != USERNAME or credentials.password != PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    request.session["username"] = credentials.username
    return {"username": credentials.username}


@app.post("/api/auth/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@app.get("/api/auth/me")
def me(username: str = Depends(current_user)):
    return {"username": username}


@app.get("/api/board")
def read_board(username: str = Depends(current_user)) -> Board:
    return Board.model_validate(db.get_board(username))


@app.put("/api/board")
def write_board(board: Board, username: str = Depends(current_user)) -> Board:
    db.save_board(username, board.model_dump())
    return board


@app.post("/api/ai/test")
def ai_test(username: str = Depends(current_user)):
    return {"answer": ai.ask("What is 2+2? Reply with just the number.")}


@app.post("/api/chat")
def chat(request: ChatRequest, username: str = Depends(current_user)) -> ChatResponse:
    board = Board.model_validate(db.get_board(username))
    try:
        result = ai.chat(board, request.history, request.message)
        if result.board is None:
            return ChatResponse(reply=result.reply, board=None)
        updated = ai.apply_update(board, result.board)
    except ai.AIError as error:
        raise HTTPException(status_code=502, detail=str(error))
    db.save_board(username, updated.model_dump())
    return ChatResponse(reply=result.reply, board=updated)


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True, check_dir=False), name="static")
