"use client";
import { useActionState } from "react";
import { login } from "./actions";
export function LoginForm({ enabled }: { enabled: boolean }) {
  const [error, action, pending] = useActionState(login, "");
  return (
    <form action={action} className="staff-form">
      <label>
        Email address
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          disabled={!enabled || pending}
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={1024}
          disabled={!enabled || pending}
        />
      </label>
      {error && (
        <p role="alert" className="staff-error">
          {error}
        </p>
      )}
      {!enabled && <p>Staff login has not been configured yet.</p>}
      <button className="button button-blue" disabled={!enabled || pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="staff-note">
        Accounts are issued by the municipal administrator. Contact your
        administrator if you need access or a password reset.
      </p>
    </form>
  );
}
