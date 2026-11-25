import { expect, test, type Page } from "@playwright/test";
import { signIn, uniqueUsername } from "./helpers";

const signUp = async (page: Page, username: string, password: string) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
};

const logOut = async (page: Page) => {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
};

test("sign up, sign out and sign back in with the new account", async ({ page }) => {
  const username = uniqueUsername("alice");
  await signUp(page, username, "secret-pass");
  await expect(page.getByRole("combobox", { name: "Current board" })).toHaveValue(/\d+/);
  await expect(page.getByText("Align roadmap themes")).toBeVisible();

  await logOut(page);
  await signIn(page, username, "secret-pass");
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
});

test("taken usernames are rejected", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("secret-pass");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("That username is taken")).toBeVisible();
});

test("each user sees only their own boards", async ({ page }) => {
  const username = uniqueUsername("bob");
  await signUp(page, username, "secret-pass");
  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("New board name").fill("Bob's private board");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("option", { name: "Bob's private board" })).toBeAttached();

  await logOut(page);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Bob's private board" })).not.toBeAttached();
});

test("change password, then delete the account", async ({ page }) => {
  const username = uniqueUsername("carol");
  await signUp(page, username, "first-pass");

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByLabel("Current password").fill("first-pass");
  await page.getByLabel("New password").fill("second-pass");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await logOut(page);
  await signIn(page, username, "first-pass");
  await expect(page.getByText("Invalid username or password")).toBeVisible();
  await signIn(page, username, "second-pass");
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByLabel("Password to confirm").fill("second-pass");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await signIn(page, username, "second-pass");
  await expect(page.getByText("Invalid username or password")).toBeVisible();
});
