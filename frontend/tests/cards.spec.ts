import { expect, test } from "@playwright/test";
import { nextSave, signInWithFreshBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInWithFreshBoard(page);
});

test("set priority, due date and labels, and keep them after a reload", async ({ page }) => {
  const card = page.getByTestId("card-card-3");
  await card.getByRole("button", { name: "Edit Prototype analytics view" }).click();
  await card.getByLabel("Priority").selectOption("high");
  await card.getByLabel("Due date").fill("2000-06-01");
  await card.getByLabel("Labels").fill("design, data");
  const save = nextSave(page);
  await card.getByRole("button", { name: "Save" }).click();
  await save;

  await page.reload();
  const meta = page.getByTestId("card-card-3").getByTestId("card-meta");
  await expect(meta).toContainText("high");
  await expect(meta).toContainText("Overdue Jun 1, 2000");
  await expect(meta).toContainText("#data");
  // The header summary counts the new overdue card and the extra high priority card
  await expect(page.getByTestId("stat-overdue")).toHaveText("1Overdue");
  await expect(page.getByTestId("stat-high-priority")).toHaveText("3High priority");
});

test("search and priority filters", async ({ page }) => {
  const titles = page.getByRole("heading", { level: 4 });
  await expect(titles).toHaveCount(8);

  await page.getByLabel("Search cards").fill("design");
  await expect(titles).toHaveText(["Prototype analytics view", "Design card layout"]);
  await expect(page.getByText("Showing 2 of 8 cards")).toBeVisible();

  await page.getByLabel("Filter by priority").selectOption("medium");
  await expect(titles).toHaveText(["Design card layout"]);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(titles).toHaveCount(8);
});

test("checklist items are added, ticked and kept after a reload", async ({ page }) => {
  const card = page.getByTestId("card-card-2");
  await card.getByRole("button", { name: "Edit Gather customer signals" }).click();
  await card.getByLabel("New checklist item").fill("Call five customers");
  await card.getByLabel("New checklist item").press("Enter");
  await card.getByLabel("New checklist item").fill("Summarise themes");
  await card.getByLabel("New checklist item").press("Enter");
  let save = nextSave(page);
  await card.getByRole("button", { name: "Save" }).click();
  await save;

  await card.getByRole("button", { name: /Checklist 0\/2/ }).click();
  save = nextSave(page);
  await card.getByRole("checkbox", { name: "Call five customers" }).check();
  await save;

  await page.reload();
  await expect(page.getByTestId("card-card-2").getByRole("button", { name: /Checklist 1\/2/ })).toBeVisible();
});
