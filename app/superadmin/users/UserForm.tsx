"use client";
import { useActionState } from "react";
import { saveUser, resetPassword } from "./actions";
import { roles, type Office, type Access } from "@/lib/offices/permissions";
export interface Account {
  user_id: string;
  display_name: string;
  email: string;
  role: string;
  active: boolean;
  deleted_at: string | null;
  created_at: string;
}
export function UserForm({
  account,
  offices,
  access = [],
}: {
  account?: Account;
  offices: Office[];
  access?: Access[];
}) {
  const [message, action, pending] = useActionState(saveUser, "");
  return (
    <form action={action} className="staff-form staff-card">
      <input type="hidden" name="user_id" value={account?.user_id || ""} />
      <label>
        Full name
        <input
          name="display_name"
          required
          maxLength={120}
          defaultValue={account?.display_name}
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          readOnly={Boolean(account)}
          defaultValue={account?.email}
        />
      </label>
      {!account && (
        <>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <label>
            Confirm password
            <input
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
        </>
      )}
      <label>
        Role
        <select name="role" required defaultValue={account?.role || "viewer"}>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role === "superadmin"
                ? "Super Admin"
                : role.charAt(0).toUpperCase() + role.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          name="active"
          defaultChecked={account ? account.active : true}
        />
        Account enabled
      </label>
      <p className="staff-note">
        Viewer: read only. Department Editors: edit their page and head; create,
        update and delete their news, programs and contacts. Admin: create,
        update, and delete within assigned access. Super Admin: unrestricted.
      </p>
      <fieldset>
        <legend>Office access</legend>
        <p>
          Choose the office this user can manage. The selected role determines
          access. Legislative Access covers the entire Legislative branch.
        </p>
        <label>
          Office Access
          <select
            name="office"
            multiple
            size={Math.min(
              8,
              Math.max(3, offices.filter((o) => o.active).length),
            )}
            defaultValue={access.map((a) => a.office_id)}
          >
            {offices
              .filter((o) => o.active)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.short_name ? ` (${o.short_name})` : ""}
                </option>
              ))}
          </select>
        </label>
        <p className="staff-note">
          Select an office. Ctrl/Cmd-click selects multiple offices for staff
          who need them. Superadmins do not need an office assignment.
        </p>
        {access.some((a) =>
          offices.some((o) => o.id === a.office_id && !o.active),
        ) && (
          <p className="staff-note">
            Inactive office assignments are removed when saving this account.
          </p>
        )}
      </fieldset>
      {account && (
        <details>
          <summary>Delete account (preserves history)</summary>
          <p>
            This disables login and removes office assignments. Auth identity
            and content history are retained. Saving again without Delete
            restores the account.
          </p>
          <label>
            <input type="checkbox" name="delete" />
            Delete this account
          </label>
          <label>
            <input type="checkbox" name="confirm_delete" />I confirm this
            account should be deleted
          </label>
        </details>
      )}
      {message && <p role="alert">{message}</p>}
      <button className="button button-blue" disabled={pending}>
        {pending ? "Saving..." : account ? "Save changes" : "Create user"}
      </button>
    </form>
  );
}
export function PasswordResetForm({ id }: { id: string }) {
  const [message, action, pending] = useActionState(resetPassword, "");
  return (
    <details className="staff-card">
      <summary>Reset password</summary>
      <form className="staff-form" action={action}>
        <input type="hidden" name="user_id" value={id} />
        <label>
          New password
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            name="confirm_password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        <p>
          Share the new password privately. This action does not send an email.
        </p>
        {message && <p role="status">{message}</p>}
        <button className="button button-blue" disabled={pending}>
          {pending ? "Resetting..." : "Reset password"}
        </button>
      </form>
    </details>
  );
}
