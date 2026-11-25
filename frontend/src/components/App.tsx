"use client";

import { useEffect, useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { Workspace } from "@/components/Workspace";
import { getCurrentUser, logout } from "@/lib/auth";
import { clearHistory } from "@/lib/chat";

export const App = () => {
  // undefined while checking the session, null when signed out
  const [user, setUser] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const handleLogout = async () => {
    clearHistory();
    await logout();
    setUser(null);
  };

  const handleAccountDeleted = () => {
    clearHistory();
    setUser(null);
  };

  if (user === undefined) {
    return null;
  }
  if (user === null) {
    return <LoginForm onLogin={setUser} />;
  }
  return (
    <Workspace
      key={user}
      username={user}
      onLogout={handleLogout}
      onAccountDeleted={handleAccountDeleted}
    />
  );
};
