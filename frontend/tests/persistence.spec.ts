import { expect, test } from "@playwright/test";
import { dragCardOver, expectBoard, nextSave, signIn, signInWithFreshBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInWithFreshBoard(page);
});

test("deleted card stays deleted after logout and sign in", async ({ page }) => {
  const save = nextSave(page);
  await page.getByRole("button", { name: "Delete Prototype analytics view", exact: true }).click();
  await save;
  await expect(page.getByText("Prototype analytics view")).toHaveCount(0);

  await page.getByRole("button", { name: "Log out" }).click();
  await signIn(page);
  await expectBoard(page);
  await expect(page.getByText("Prototype analytics view")).toHaveCount(0);
});

test("moved card stays in its new column after reload", async ({ page }) => {
  const card = page.getByTestId("card-card-1");
  const target = page.getByTestId("column-col-review");
  await dragCardOver(page, card, target);
  const save = nextSave(page);
  await page.mouse.up();
  await save;
  await expect(target.getByTestId("card-card-1")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-1")).toBeVisible();
});

test("edited card, new card and renamed column survive reload", async ({ page }) => {
  const card = page.getByTestId("card-card-2");
  await card.getByRole("button", { name: "Edit Gather customer signals", exact: true }).click();
  await card.getByLabel("Card title").fill("Edited and saved");
  let save = nextSave(page);
  await card.getByRole("button", { name: "Save", exact: true }).click();
  await save;

  const column = page.getByTestId("column-col-done");
  await column.getByRole("button", { name: /add a card/i }).click();
  await column.getByPlaceholder("Card title").fill("Persisted card");
  save = nextSave(page);
  await column.getByRole("button", { name: /add card/i }).click();
  await save;

  const title = page.getByTestId("column-col-backlog").getByLabel("Column title");
  await title.fill("Ideas");
  save = nextSave(page);
  await title.blur();
  await save;

  await page.reload();
  await expectBoard(page);
  await expect(page.getByText("Edited and saved")).toBeVisible();
  await expect(page.getByTestId("column-col-done").getByText("Persisted card")).toBeVisible();
  await expect(page.getByTestId("column-col-backlog").getByLabel("Column title")).toHaveValue("Ideas");
});
