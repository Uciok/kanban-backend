import { expect, type Locator, type Page } from "@playwright/test";
import { defaultBoard } from "../src/test/board";

export const expectBoard = (page: Page) =>
  expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();

export const signIn = async (page: Page, username = "user", password = "password") => {
  await page.goto("/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
};

export const signUp = async (page: Page, username: string, password: string) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expectBoard(page);
};

// Tests share one database, so reset the signed-in user to a single default board "My board"
export const resetBoards = async (page: Page) => {
  const boards: { id: number }[] = await (await page.request.get("/api/boards")).json();
  const [first, ...rest] = boards;
  for (const board of rest) {
    await page.request.delete(`/api/boards/${board.id}`);
  }
  await page.request.put(`/api/boards/${first.id}`, { data: defaultBoard });
  await page.request.patch(`/api/boards/${first.id}`, { data: { name: "My board" } });
};

export const signInWithFreshBoard = async (page: Page) => {
  await signIn(page);
  await expectBoard(page);
  await resetBoards(page);
  await page.reload();
  await expectBoard(page);
};

// A username no other run has used, for tests that create accounts
export const uniqueUsername = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Resolves when the next board save completes; create it before the action that saves
export const nextSave = (page: Page) =>
  page.waitForResponse(
    (response) =>
      /\/api\/boards\/\d+$/.test(response.url()) && response.request().method() === "PUT"
  );

// Picks up the card and holds it over the target column; the caller drops it with page.mouse.up()
export const dragCardOver = async (page: Page, card: Locator, target: Locator) => {
  // Mouse drags only work on what is in the viewport
  await card.scrollIntoViewIfNeeded();
  const cardBox = (await card.boundingBox())!;
  const targetBox = (await target.boundingBox())!;
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 120, { steps: 12 });
};
