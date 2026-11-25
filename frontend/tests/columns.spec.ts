import { expect, test } from "@playwright/test";
import { nextSave, signInWithFreshBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInWithFreshBoard(page);
});

const columnTitles = (page: import("@playwright/test").Page) =>
  page.getByLabel("Column title").evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));

test("add, move and delete columns, and keep the order after a reload", async ({ page }) => {
  await page.getByRole("button", { name: "Add column" }).click();
  await page.getByLabel("New column title").fill("Blocked");
  let save = nextSave(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await save;

  save = nextSave(page);
  await page.getByRole("button", { name: "Move Blocked left" }).click();
  await save;
  expect(await columnTitles(page)).toEqual(["Backlog", "Discovery", "In Progress", "Review", "Blocked", "Done"]);

  await page.reload();
  await expect(page.getByLabel("Column title")).toHaveCount(6);
  expect(await columnTitles(page)).toEqual(["Backlog", "Discovery", "In Progress", "Review", "Blocked", "Done"]);

  await expect(page.getByRole("button", { name: "Delete column Blocked" })).toBeEnabled();
  save = nextSave(page);
  await page.getByRole("button", { name: "Delete column Blocked" }).click();
  await save;
  await page.reload();
  await expect(page.getByLabel("Column title")).toHaveCount(5);
  expect(await columnTitles(page)).not.toContain("Blocked");
});

test("columns with cards cannot be deleted", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Delete column Backlog" })).toBeDisabled();
});
