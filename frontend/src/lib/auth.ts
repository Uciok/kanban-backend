import { errorOrNull, jsonRequest } from "@/lib/api";

export const getCurrentUser = async (): Promise<string | null> => {
  const response = await fetch("/api/auth/me");
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data.username;
};

export const login = async (username: string, password: string) => {
  const response = await fetch("/api/auth/login", jsonRequest("POST", { username, password }));
  return response.ok;
};

// Returns an error message, or null on success (and the user is signed in)
export const register = async (username: string, password: string) => {
  const response = await fetch("/api/auth/register", jsonRequest("POST", { username, password }));
  if (response.status === 422) {
    return "Use 3-32 letters, numbers, dots, dashes or underscores for the username, and at least 8 characters for the password";
  }
  return errorOrNull(response, "Could not create the account");
};

export const logout = async () => {
  await fetch("/api/auth/logout", { method: "POST" });
};

// Returns an error message, or null on success
export const changePassword = async (currentPassword: string, newPassword: string) => {
  const response = await fetch(
    "/api/auth/password",
    jsonRequest("POST", { current_password: currentPassword, new_password: newPassword })
  );
  if (response.status === 422) {
    return "The new password needs at least 8 characters";
  }
  return errorOrNull(response, "Could not change the password");
};

// Returns an error message, or null when the account was deleted
export const deleteAccount = async (password: string) => {
  const response = await fetch("/api/auth/me", jsonRequest("DELETE", { password }));
  return errorOrNull(response, "Could not delete the account");
};
