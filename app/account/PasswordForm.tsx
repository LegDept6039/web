"use client";
import { useActionState } from "react";
import { changePassword } from "./actions";
export function PasswordForm() {
  const [message, action, pending] = useActionState(changePassword, "");
  return (
    <form className="staff-form" action={action}>
      <h2>Change password</h2>
      <label>
        Current password
        <input
          type="password"
          name="current_password"
          autoComplete="current-password"
          required
        />
      </label>
      <label>
        New password
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      <label>
        Confirm password
        <input
          type="password"
          name="confirm_password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
        />
      </label>
      {message && <p role="status">{message}</p>}
      <button className="button button-blue" disabled={pending}>
        {pending ? "Saving..." : "Change password"}
      </button>
    </form>
  );
}
