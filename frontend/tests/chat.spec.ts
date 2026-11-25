import { expect, test } from "@playwright/test";
import { defaultBoard } from "../src/test/board";
import { signIn, signInWithFreshBoard } from "./helpers";

// The AI is mocked in the browser, so these tests do not call OpenRouter
test.beforeEach(async ({ page }) => {
  const board = structuredClone(defaultBoard);
  board.cards["card-ai"] = { id: "card-ai", title: "Made by AI", details: "From chat", priority: null, dueDate: null, labels: [], checklist: [] };
  board.columns[1].cardIds.push("card-ai");
  await page.route("**/api/boards/*/chat", (route) =>
    route.fulfill({ json: { reply: "Added a card to Discovery.", board } })
  );
  await signInWithFreshBoard(page);
});

test("chat reply updates the board", async ({ page }) => {
  await page.getByRole("button", { name: "AI chat" }).click();
  await page.getByLabel("Message").fill("Add a card to Discovery");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Added a card to Discovery.")).toBeVisible();
  await expect(page.getByTestId("column-col-discovery").getByText("Made by AI")).toBeVisible();
});

test("chat history survives a reload and is cleared on logout", async ({ page }) => {
  await page.getByRole("button", { name: "AI chat" }).click();
  await page.getByLabel("Message").fill("Hello there");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Added a card to Discovery.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "AI chat" }).click();
  await expect(page.getByText("Hello there")).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await signIn(page);
  await page.getByRole("button", { name: "AI chat" }).click();
  await expect(page.getByText("Hello there")).toHaveCount(0);
});
