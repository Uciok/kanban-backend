import { useState, type FormEvent } from "react";
import { changePassword, deleteAccount } from "@/lib/auth";

type AccountPanelProps = {
  username: string;
  onClose: () => void;
  onDeleted: () => void;
};

const inputClass =
  "w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-base sm:text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]";
const primaryClass =
  "rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110";
const headingClass = "font-display text-lg font-semibold text-[var(--navy-dark)]";

export const AccountPanel = ({ username, onClose, onDeleted }: AccountPanelProps) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = await changePassword(currentPassword, newPassword);
    setPasswordMessage(error ?? "Password changed");
    if (!error) {
      setCurrentPassword("");
      setNewPassword("");
    }
  };

  const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = await deleteAccount(deletePassword);
    if (error) {
      setDeleteError(error);
    } else {
      onDeleted();
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-[rgba(3,33,71,0.35)] p-4 sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        className="w-full max-w-md space-y-6 rounded-3xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="h-1 w-10 rounded-full bg-[var(--accent-yellow)]" />
            <h2 className="mt-3 font-display text-xl font-semibold text-[var(--navy-dark)]">Account</h2>
            <p className="mt-1 text-sm text-[var(--gray-text)]">
              Signed in as <strong className="text-[var(--navy-dark)]">{username}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          >
            Close
          </button>
        </header>

        <form onSubmit={handleChangePassword} className="space-y-3">
          <h3 className={headingClass}>Change password</h3>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            aria-label="Current password"
            placeholder="Current password"
            autoComplete="current-password"
            className={inputClass}
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            aria-label="New password"
            placeholder="New password (8+ characters)"
            autoComplete="new-password"
            minLength={8}
            className={inputClass}
            required
          />
          {passwordMessage && (
            <p className="text-sm font-semibold text-[var(--secondary-purple)]">{passwordMessage}</p>
          )}
          <button type="submit" className={primaryClass}>
            Change password
          </button>
        </form>

        <form onSubmit={handleDelete} className="space-y-3 border-t border-[var(--stroke)] pt-6">
          <h3 className={headingClass}>Delete account</h3>
          <p className="text-sm text-[var(--gray-text)]">
            This permanently deletes your account and all your boards.
          </p>
          <input
            type="password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            aria-label="Password to confirm"
            placeholder="Password"
            autoComplete="current-password"
            className={inputClass}
            required
          />
          {deleteError && (
            <p className="text-sm font-semibold text-[var(--secondary-purple)]">{deleteError}</p>
          )}
          <button type="submit" className={primaryClass}>
            Delete my account
          </button>
        </form>
      </section>
    </div>
  );
};
