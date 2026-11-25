import { expect, test } from "@playwright/test";
import { expectBoard, signIn } from "./helpers";

test("requires sign in to see the board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toHaveCount(0);
});

test("rejects invalid credentials", async ({ page }) => {
  await signIn(page, "user", "wrong");
  await expect(page.getByText("Invalid username or password")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toHaveCount(0);
});

test("keeps the session across reloads and logs out", async ({ page }) => {
  await signIn(page);
  await expectBoard(page);
  await page.reload();
  await expectBoard(page);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
