"use client";
import { useActionState } from "react";
import { deleteTransparency } from "@/app/superadmin/transparency/actions";
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
    <details className="transparency-delete">
      <summary>
        Delete<span className="sr-only"> {title}</span>
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
