"use client";
import { useActionState } from "react";
import { updateStaff } from "./actions";
export function StaffForm({
  account,
}: {
  account: {
    user_id: string;
    email: string;
    display_name: string;
    role: string;
    active: boolean;
  };
}) {
  const [message, action, pending] = useActionState(updateStaff, "");
  return (
    <form action={action} className="staff-card staff-form">
      <strong style={{ overflowWrap: "anywhere" }}>{account.email}</strong>
      <input type="hidden" name="user_id" value={account.user_id} />
      <label>
        Display name
        <input
          name="display_name"
          maxLength={120}
          defaultValue={account.display_name}
          disabled={pending}
        />
      </label>
      <label>
        Role
        <select name="role" defaultValue={account.role} disabled={pending}>
          <option value="user">User</option>
          <option value="superadmin">Superadmin</option>
        </select>
      </label>
      <label>
        <input
          name="active"
          type="checkbox"
          defaultChecked={account.active}
          disabled={pending}
        />
        Access enabled
      </label>
      <p className="staff-note">
        Superadmins can publish content and manage other staff accounts.
      </p>
      {message && <p role="status">{message}</p>}
      <button className="button button-blue" disabled={pending}>
        {pending ? "Saving…" : "Save access"}
      </button>
    </form>
  );
}
