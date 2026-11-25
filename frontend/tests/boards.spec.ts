import { expect, test, type Page } from "@playwright/test";
import { nextSave, signInWithFreshBoard } from "./helpers";

const boardSelect = (page: Page) => page.getByRole("combobox", { name: "Current board" });

const createBoard = async (page: Page, name: string) => {
  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("New board name").fill(name);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("option", { name })).toBeAttached();
};

test.beforeEach(async ({ page }) => {
  await signInWithFreshBoard(page);
});

test("create a board, add a card and switch back", async ({ page }) => {
  await createBoard(page, "Launch plan");
  await expect(boardSelect(page).locator("option:checked")).toHaveText("Launch plan");
  await expect(page.getByText("Align roadmap themes")).toHaveCount(0);

  const column = page.getByTestId("column-col-backlog");
  await column.getByRole("button", { name: "Add a card" }).click();
  await column.getByPlaceholder("Card title").fill("Book the venue");
  const save = nextSave(page);
  await column.getByRole("button", { name: "Add card" }).click();
  await save;

  await boardSelect(page).selectOption({ label: "My board" });
  await expect(page.getByText("Align roadmap themes")).toBeVisible();
  await expect(page.getByText("Book the venue")).toHaveCount(0);

  // The open board and its cards survive a reload
  await boardSelect(page).selectOption({ label: "Launch plan" });
  await page.reload();
  await expect(boardSelect(page).locator("option:checked")).toHaveText("Launch plan");
  await expect(page.getByText("Book the venue")).toBeVisible();
});

test("rename a board", async ({ page }) => {
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Board name").fill("Roadmap");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("option", { name: "Roadmap" })).toBeAttached();

  await page.reload();
  await expect(boardSelect(page).locator("option:checked")).toHaveText("Roadmap");
});

test("delete a board", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();
  await createBoard(page, "Scratch");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete board" }).click();

  await expect(page.getByRole("option", { name: "Scratch" })).not.toBeAttached();
  await expect(page.getByText("Align roadmap themes")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("option", { name: "Scratch" })).not.toBeAttached();
});
