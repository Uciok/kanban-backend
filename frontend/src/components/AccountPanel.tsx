import { useState, type FormEvent } from "react";
import clsx from "clsx";
import { Dialog } from "@/components/Dialog";
import { changePassword, deleteAccount } from "@/lib/auth";
import { messageClass, inputClass, primaryButtonClass } from "@/lib/styles";

type AccountPanelProps = {
  username: string;
  onClose: () => void;
  onDeleted: () => void;
};

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
    <Dialog
      title="Account"
      description={
        <>
          Signed in as <strong className="text-[var(--navy-dark)]">{username}</strong>
        </>
      }
      onClose={onClose}
      className="space-y-6"
    >
      <form onSubmit={handleChangePassword} className="space-y-3">
        <h3 className={headingClass}>Change password</h3>
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          aria-label="Current password"
          placeholder="Current password"
          autoComplete="current-password"
          className={clsx("w-full", inputClass)}
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
          className={clsx("w-full", inputClass)}
          required
        />
        {passwordMessage && (
          <p className={messageClass}>{passwordMessage}</p>
        )}
        <button type="submit" className={primaryButtonClass}>
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
          className={clsx("w-full", inputClass)}
          required
        />
        {deleteError && (
          <p className={messageClass}>{deleteError}</p>
        )}
        <button type="submit" className={primaryButtonClass}>
          Delete my account
        </button>
      </form>
    </Dialog>
  );
};
