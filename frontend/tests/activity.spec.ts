import { expect, test } from "@playwright/test";
import { nextSave, uniqueUsername } from "./helpers";

// A fresh account, so the log holds only this test's changes
test("changes show up in the board's activity", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Username").fill(uniqueUsername("dana"));
  await page.getByLabel("Password").fill("secret-pass");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();

  const column = page.getByTestId("column-col-backlog");
  await column.getByRole("button", { name: "Add a card" }).click();
  await column.getByPlaceholder("Card title").fill("Write the brief");
  let save = nextSave(page);
  await column.getByRole("button", { name: "Add card" }).click();
  await save;

  save = nextSave(page);
  await page.getByRole("button", { name: "Delete Gather customer signals", exact: true }).click();
  await save;

  await page.getByRole("button", { name: "Activity" }).click();
  const items = page.getByRole("list", { name: "Recent changes" }).getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Deleted card "Gather customer signals"');
  await expect(items.nth(1)).toContainText('Added card "Write the brief" to Backlog');
  await expect(items.nth(0)).toContainText("just now");
});
