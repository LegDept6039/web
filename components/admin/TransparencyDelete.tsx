"use client";
import { useActionState } from "react";
import { deleteTransparency } from "@/app/superadmin/transparency/actions";
import { AdminActionIcon } from "./AdminActionLink";
export function TransparencyDelete({
  kind,
  id,
  updatedAt,
  title,
}: {
  kind: "categories" | "documents";
  id: string;
  updatedAt: string;
  title: string;
}) {
  const [error, action, pending] = useActionState(deleteTransparency, "");
  return (
    <details
      className="transparency-delete"
      onToggle={(event) => {
        if (!event.currentTarget.open) return;
        const actions = event.currentTarget.closest(".admin-row-actions");
        requestAnimationFrame(() =>
          actions?.scrollIntoView({ block: "nearest", inline: "nearest" }),
        );
      }}
    >
      <summary
        className="admin-row-action admin-row-action-danger"
        aria-label={`Delete ${title}`}
        title={`Delete ${title}`}
      >
        <AdminActionIcon action="delete" />
      </summary>
      <form action={action}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="original" value={id} />
        <input type="hidden" name="updated_at" value={updatedAt} />
        <p>
          Remove “{title}” from the website? Its record and files will be
          retained.
        </p>
        <label>
          <input type="checkbox" name="confirm" required /> Confirm deletion
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="button button-blue" disabled={pending}>
          {pending ? "Deleting…" : "Delete"}
        </button>
      </form>
    </details>
  );
}
