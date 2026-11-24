"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { ResetPasswordResult } from "@/lib/auth/password-reset-types";
import { resetPassword } from "./actions";
import type { Account } from "./UserForm";

type ResetAccount = Pick<
  Account,
  "user_id" | "display_name" | "username" | "active"
>;

function ResetConfirmation({
  account,
  onClose,
}: {
  account: ResetAccount;
  onClose: () => void;
}) {
  const [result, action, pending] = useActionState<
    ResetPasswordResult,
    FormData
  >(resetPassword, { message: "" });
  const [copyMessage, setCopyMessage] = useState("");

  async function copyPassword() {
    if (!result.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
      setCopyMessage("Temporary password copied.");
    } catch {
      setCopyMessage(
        "Copy was unavailable. Select and copy the password above.",
      );
    }
  }

  if (result.temporaryPassword && result.expiresAt) {
    return (
      <div className="staff-password-result">
        <p role="status">{result.message}</p>
        <p>
          Give this password privately to{" "}
          <strong>{account.display_name}</strong> ({account.username}). It is shown
          only here and cannot be retrieved after you close this panel or leave
          this page.
        </p>
        <div className="staff-password-secret">
          <span>Temporary password</span>
          <code data-testid="temporary-password">
            {result.temporaryPassword}
          </code>
        </div>
        <p className="staff-note">
          Expires{" "}
          <time dateTime={result.expiresAt}>
            {new Intl.DateTimeFormat("en-PH", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Manila",
            }).format(new Date(result.expiresAt))}
          </time>{" "}
          (Philippine time). The staff member must create a new password before
          accessing the CMS.
        </p>
        <div className="staff-password-actions">
          <button
            type="button"
            className="button button-blue account-action-button"
            onClick={copyPassword}
          >
            Copy temporary password
          </button>
          <button
            type="button"
            className="button staff-secondary-button account-action-button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
        {copyMessage && (
          <p role="status" className="staff-note">
            {copyMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <form className="staff-form" action={action}>
      <input type="hidden" name="user_id" value={account.user_id} />
      <h3>Confirm Password Reset</h3>
      <p>
        Reset the password for <strong>{account.display_name}</strong> (
        {account.username})? Their current password and sessions will no longer
        provide CMS access. Any previous temporary password will be replaced.
      </p>
      <p className="staff-note">
        Their role, office assignments and account status stay the same.
        {!account.active &&
          " This account is disabled and will remain disabled."}
      </p>
      <label>
        <input
          type="checkbox"
          name="confirm_reset"
          required
          disabled={pending}
        />
        I verified this staff member’s identity and confirm this password reset.
      </label>
      {result.message && (
        <p role="alert" className="staff-error">
          {result.message}
        </p>
      )}
      <div className="staff-password-actions">
        <button
          className="button button-blue account-action-button"
          disabled={pending}
        >
          {pending ? "Resetting..." : "Reset Password"}
        </button>
        <button
          type="button"
          className="button staff-secondary-button account-action-button"
          disabled={pending}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function PasswordResetForm({
  account,
  isSelf = false,
}: {
  account: ResetAccount;
  isSelf?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section
      className="staff-card staff-password-reset"
      aria-labelledby="password-reset-title"
    >
      <h2 id="password-reset-title">Reset Password</h2>
      {isSelf ? (
        <p>
          To change your own password, use{" "}
          <Link href="/account">your profile</Link>.
        </p>
      ) : open ? (
        <ResetConfirmation account={account} onClose={() => setOpen(false)} />
      ) : (
        <>
          <p>
            Issue a temporary password after verifying this staff member’s
            identity.
          </p>
          <button
            type="button"
            className="button button-blue account-action-button"
            onClick={() => setOpen(true)}
          >
            Reset Password
          </button>
        </>
      )}
    </section>
  );
}
