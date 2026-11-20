"use client";

import { useActionState } from "react";
import { logout } from "@/app/login/actions";
import { changeRequiredPassword } from "./actions";

export function ChangePasswordForm({
  email,
  expiresAt,
}: {
  email?: string;
  expiresAt?: string;
}) {
  const [message, action, pending] = useActionState(changeRequiredPassword, "");
  return (
    <>
      {email && <p className="staff-reset-account">{email}</p>}
      <p>Choose a new password to continue to your municipal staff account.</p>
      <form
        className="staff-form"
        action={action}
        onReset={(event) => event.preventDefault()}
      >
        <label>
          Enter new password
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            disabled={pending}
            aria-describedby="reset-password-policy"
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            name="confirm_password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            disabled={pending}
          />
        </label>
        <p id="reset-password-policy" className="staff-note">
          Use 12 to 128 characters. Your new password must be different from the
          temporary password.
        </p>
        {expiresAt && (
          <p className="staff-note">
            Complete this change before{" "}
            <time dateTime={expiresAt}>
              {new Intl.DateTimeFormat("en-PH", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Manila",
              }).format(new Date(expiresAt))}
            </time>{" "}
            (Philippine time). If your temporary password expires, contact the
            Superadmin for a new one.
          </p>
        )}
        {message && (
          <p role="alert" className="staff-error">
            {message}
          </p>
        )}
        <button className="button button-blue" disabled={pending}>
          {pending ? "Saving..." : "Save password"}
        </button>
      </form>
      <form action={logout} className="staff-reset-signout">
        <button className="button staff-secondary-button">Sign out</button>
      </form>
    </>
  );
}
