import { expect, test } from "@playwright/test";
import { signInWithFreshBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInWithFreshBoard(page);
});

test("board starts on the first screen", async ({ page }) => {
  const viewport = page.viewportSize()!;
  const firstColumn = page.getByTestId("column-col-backlog");
  await expect(firstColumn).toBeInViewport();
  expect((await firstColumn.boundingBox())!.y).toBeLessThan(viewport.height / 2);
  // Desktop-only header text is hidden on phones
  await expect(page.getByText("Project management", { exact: true })).toBeHidden();
});

test("columns are swiped sideways, one per screen", async ({ page }) => {
  const viewport = page.viewportSize()!;
  const backlog = page.getByTestId("column-col-backlog");
  const done = page.getByTestId("column-col-done");
  expect((await backlog.boundingBox())!.width).toBeGreaterThan(viewport.width * 0.7);
  await expect(done).not.toBeInViewport();

  await done.scrollIntoViewIfNeeded();
  await expect(done).toBeInViewport();
  // Scrolling sideways keeps the page itself from scrolling sideways
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
});

test("chat fills the screen and its input does not trigger zoom", async ({ page }) => {
  const viewport = page.viewportSize()!;
  await page.getByRole("button", { name: "AI chat" }).click();
  const chat = page.getByRole("complementary", { name: "AI chat" });
  expect((await chat.boundingBox())!.width).toBe(viewport.width);

  // iOS zooms into inputs with text smaller than 16px
  const fontSize = await page.getByLabel("Message").evaluate((el) => getComputedStyle(el).fontSize);
  expect(fontSize).toBe("16px");
});
