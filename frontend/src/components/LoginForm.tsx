import { useState, type FormEvent } from "react";
import clsx from "clsx";
import { login, register } from "@/lib/auth";
import { messageClass, inputClass } from "@/lib/styles";

type LoginFormProps = {
  onLogin: (username: string) => void;
};

export const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSignUp) {
      const registerError = await register(username, password);
      if (registerError) {
        setError(registerError);
      } else {
        onLogin(username);
      }
      return;
    }
    if (await login(username, password)) {
      onLogin(username);
    } else {
      setError("Invalid username or password");
    }
  };

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setError("");
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-[32px] border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Project management
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            {isSignUp ? "Create account" : "Sign in"}
          </h1>
        </div>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          aria-label="Username"
          placeholder="Username"
          autoComplete="username"
          className={clsx("w-full", inputClass)}
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-label="Password"
          placeholder={isSignUp ? "Password (8+ characters)" : "Password"}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          className={clsx("w-full", inputClass)}
          required
        />
        {error && (
          <p role="alert" className={messageClass}>
            {error}
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
        >
          {isSignUp ? "Create account" : "Sign in"}
        </button>
        <p className="text-center text-sm text-[var(--gray-text)]">
          {isSignUp ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            onClick={switchMode}
            className="font-semibold text-[var(--primary-blue)] hover:underline"
          >
            {isSignUp ? "Sign in" : "Create an account"}
          </button>
        </p>
      </form>
    </main>
  );
};
