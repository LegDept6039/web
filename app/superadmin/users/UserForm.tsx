"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { saveUser } from "./actions";
import { roles, type Office, type Access } from "@/lib/offices/permissions";
export interface Account {
  user_id: string;
  display_name: string;
  username: string;
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
  const activeOffices = offices.filter((office) => office.active);
  const [selectedOffices, setSelectedOffices] = useState<string[]>(() => [
    ...access
      .filter((assignment) =>
        activeOffices.some((office) => office.id === assignment.office_id),
      )
      .map((assignment) => assignment.office_id),
    ...(account?.transparency_access ? ["transparency"] : []),
  ]);
  function toggleOffice(value: string) {
    setSelectedOffices((selected) =>
      selected.includes(value)
        ? selected.filter((id) => id !== value)
        : [...selected, value],
    );
  }
  const officeChoices = [
    {
      value: "transparency",
      name: "Transparency",
      detail: "Modules, reports and PDFs",
    },
    ...activeOffices.map((office) => {
      const shortName = office.short_name?.trim();
      return {
        value: office.id,
        name: office.name,
        detail:
          shortName &&
          shortName.toLowerCase() !== office.name.trim().toLowerCase()
            ? shortName
            : office.department === "legislative"
              ? "Legislative branch"
              : "Executive office",
      };
    }),
  ];
  return (
    <form action={action} className="staff-form staff-card account-form">
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
        Username
        <input
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={3}
          maxLength={40}
          pattern={"[A-Za-z0-9][A-Za-z0-9._\\-]{2,39}"}
          aria-describedby="username-policy"
          defaultValue={account?.username}
        />
      </label>
      <p id="username-policy" className="staff-note">
        Use 3 to 40 letters, numbers, periods, underscores or hyphens. Start
        with a letter or number. Usernames are saved in lowercase.
      </p>
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
      <fieldset
        className="account-office-access"
        hidden={selectedRole === "superadmin"}
        aria-describedby="office-access-help office-access-scope"
      >
        <legend>Office access</legend>
        <div className="account-access-intro">
          <p id="office-access-help">
            Select one or more offices. The user’s role determines what they can
            do.
          </p>
          <span className="account-access-count" aria-live="polite">
            {selectedOffices.length} selected
          </span>
        </div>
        <div className="account-office-table-wrap">
          <table className="account-office-table" aria-label="Office access">
            <thead>
              <tr>
                <th scope="col" className="account-office-select">
                  Select
                </th>
                <th scope="col">Office</th>
              </tr>
            </thead>
            <tbody>
              {officeChoices.map((office) => (
                <tr key={office.value}>
                  <td className="account-office-select">
                    <input
                      id={`office-access-${office.value}`}
                      type="checkbox"
                      name="office"
                      value={office.value}
                      checked={selectedOffices.includes(office.value)}
                      onChange={() => toggleOffice(office.value)}
                    />
                  </td>
                  <th scope="row">
                    <label htmlFor={`office-access-${office.value}`}>
                      <span className="account-office-name">{office.name}</span>{" "}
                      <span className="account-office-meta">
                        {office.detail}
                      </span>
                    </label>
                  </th>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p id="office-access-scope" className="staff-note">
          Legislative Access covers the entire Legislative branch. For
          Transparency, Editors and Admins manage modules, reports and PDFs;
          Viewers have read-only access.
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
        <details className="account-delete">
          <summary>
            <span>
              Delete account <small>(preserves history)</small>
            </span>
          </summary>
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
      {message && (
        <p role="alert" className="staff-error">
          {message}
        </p>
      )}
      <div className="account-form-actions">
        <button
          className="button button-blue account-action-button"
          disabled={pending}
        >
          {pending ? "Saving..." : account ? "Save changes" : "Create user"}
        </button>
        <Link
          className="button staff-secondary-button account-action-button"
          href="/superadmin/users"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
