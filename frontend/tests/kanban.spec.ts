import { expect, test } from "@playwright/test";
import { dragCardOver, expectBoard, signInWithFreshBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInWithFreshBoard(page);
});

test("loads the kanban board", async ({ page }) => {
  await expectBoard(page);
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  await dragCardOver(page, card, targetColumn);
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("edits a card", async ({ page }) => {
  const card = page.getByTestId("card-card-2");
  await card.getByRole("button", { name: "Edit Gather customer signals", exact: true }).click();
  await card.getByLabel("Card title").fill("Edited in e2e");
  await card.getByLabel("Card details").fill("New details.");
  await card.getByRole("button", { name: "Save", exact: true }).click();
  await expect(card.getByText("Edited in e2e")).toBeVisible();
  await expect(card.getByText("New details.")).toBeVisible();
});

test("deletes a card", async ({ page }) => {
  await page.getByRole("button", { name: "Delete Ship marketing page", exact: true }).click();
  await expect(page.getByText("Ship marketing page")).toHaveCount(0);
});

test("renames a column", async ({ page }) => {
  const title = page.getByTestId("column-col-backlog").getByLabel("Column title");
  await title.fill("Ideas");
  await expect(title).toHaveValue("Ideas");
});
