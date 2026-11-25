import { saveBoard } from "@/lib/api";
import { sendChat } from "@/lib/chat";
import { cloneBoard } from "@/test/board";
import { jsonResponse } from "@/test/fakeBackend";

// Stubs fetch so each request stays open until the test resolves it
const controlledFetch = () => {
  const requests: { url: string; respond: (response: Response) => void }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url: string) =>
        new Promise<Response>((respond) => {
          requests.push({ url, respond });
        })
    )
  );
  return requests;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveBoard", () => {
  it("sends the next save only after the previous one finished", async () => {
    const requests = controlledFetch();
    const first = saveBoard(cloneBoard());
    const second = saveBoard(cloneBoard());
    await flush();
    expect(requests).toHaveLength(1);

    requests[0].respond(jsonResponse(200, {}));
    await first;
    await flush();
    expect(requests).toHaveLength(2);

    requests[1].respond(jsonResponse(401, {}));
    expect(await second).toBe(false);
  });

  it("keeps saving after a failed save", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline")));
    await expect(saveBoard(cloneBoard())).rejects.toThrow("offline");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, {})));
    expect(await saveBoard(cloneBoard())).toBe(true);
  });
});

describe("sendChat", () => {
  it("waits for pending saves before asking the AI", async () => {
    const requests = controlledFetch();
    saveBoard(cloneBoard());
    const reply = sendChat("Hi", []);
    await flush();
    expect(requests.map((request) => request.url)).toEqual(["/api/board"]);

    requests[0].respond(jsonResponse(200, {}));
    await flush();
    expect(requests.map((request) => request.url)).toEqual(["/api/board", "/api/chat"]);

    requests[1].respond(jsonResponse(200, { reply: "Hello", board: null }));
    expect(await reply).toEqual({ reply: "Hello", board: null });
  });
});
