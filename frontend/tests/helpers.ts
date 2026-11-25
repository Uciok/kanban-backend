import { expect, type Page } from "@playwright/test";
import { defaultBoard } from "../src/test/board";

export const signIn = async (page: Page, username = "user", password = "password") => {
  await page.goto("/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
};

// Signs in and resets the stored board to the default, since tests share one database
export const signInWithFreshBoard = async (page: Page) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await page.request.put("/api/board", { data: defaultBoard });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
};

// Resolves when the next board save completes; create it before the action that saves
export const nextSave = (page: Page) =>
  page.waitForResponse(
    (response) => response.url().endsWith("/api/board") && response.request().method() === "PUT"
  );
