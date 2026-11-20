"use client";
import { useActionState, useState } from "react";
import { saveUser } from "./actions";
import { roles, type Office, type Access } from "@/lib/offices/permissions";
export interface Account {
  user_id: string;
  display_name: string;
  email: string;
  role: string;
  active: boolean;
  deleted_at: string | null;
  created_at: string;
  transparency_access?: boolean;
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
  const [selectedRole, setSelectedRole] = useState(account?.role || "viewer");
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
        <select
          name="role"
          required
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value)}
        >
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
      {selectedRole === "superadmin" && (
        <p className="staff-note">
          Super Admin has access to all offices and modules. No office
          assignment is needed.
        </p>
      )}
      <fieldset hidden={selectedRole === "superadmin"}>
        <legend>Office access</legend>
        <p>
          Choose the office this user can manage. The selected role determines
          access. Legislative Access covers the entire Legislative branch.
          Transparency covers all Transparency modules, reports and PDFs.
        </p>
        <label>
          Office Access
          <select
            name="office"
            multiple
            size={Math.min(
              8,
              Math.max(3, offices.filter((o) => o.active).length + 1),
            )}
            defaultValue={[
              ...access.map((a) => a.office_id),
              ...(account?.transparency_access ? ["transparency"] : []),
            ]}
          >
            <option value="transparency">Transparency</option>
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
          who need them. For Transparency, Editors and Admins can manage modules
          and reports; Viewers can only read records and preview PDFs.
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
