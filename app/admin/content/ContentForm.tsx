"use client";
import { useActionState } from "react";
import { definitions, type Collection } from "@/lib/content/schema";
import { label } from "@/lib/admin/content";
import { saveContent, deleteContent } from "./actions";
export function ContentForm({
  collection,
  row = {},
}: {
  collection: Collection;
  row?: Record<string, unknown>;
}) {
  const [error, action, pending] = useActionState(saveContent, "");
  const [deleteError, remove, deleting] = useActionState(deleteContent, "");
  const definition = definitions[collection];
  const original = String(row[definition.key] || "");
  const hidden = (
    <>
      <input type="hidden" name="collection" value={collection} />
      <input type="hidden" name="original" value={original} />
      <input
        type="hidden"
        name="updated_at"
        value={String(row.updated_at || "")}
      />
    </>
  );
  return (
    <>
      <form className="staff-form staff-card" action={action}>
        {hidden}
        {Object.entries(definition.fields).map(([name, field]) => {
          const value = row[field.column];
          const props = {
            name: field.column,
            required: !field.optional,
            disabled: pending,
            defaultValue: value == null ? "" : String(value),
          };
          return (
            <label key={name}>
              {label(name)}
              {field.optional ? " (optional)" : ""}
              {field.kind === "boolean" ? (
                <input
                  type="checkbox"
                  name={field.column}
                  defaultChecked={value === true}
                  disabled={pending}
                />
              ) : field.values ? (
                <select {...props}>
                  <option value="">Select…</option>
                  {field.values.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              ) : field.kind === "list" ? (
                <>
                  <textarea
                    {...props}
                    defaultValue={Array.isArray(value) ? value.join("\n") : ""}
                  />
                  <span className="staff-note">
                    One item or paragraph per line.
                  </span>
                </>
              ) : [
                  "description",
                  "summary",
                  "excerpt",
                  "responsibility",
                ].includes(name) ? (
                <textarea {...props} />
              ) : (
                <input
                  {...props}
                  readOnly={Boolean(
                    original && field.column === definition.key,
                  )}
                  type={
                    field.kind === "integer"
                      ? "number"
                      : field.kind === "date"
                        ? "date"
                        : "text"
                  }
                />
              )}
            </label>
          );
        })}
        <label>
          Sort order
          <input
            name="sort_order"
            type="number"
            step="1"
            defaultValue={Number(row.sort_order || 0)}
            disabled={pending}
          />
        </label>
        <label>
          <input
            name="published"
            type="checkbox"
            defaultChecked={row.published === true}
            disabled={pending}
          />
          Published — visible on the public website
        </label>
        {error && (
          <p role="alert" className="staff-error">
            {error}
          </p>
        )}
        <button className="button button-blue" disabled={pending}>
          {pending ? "Saving…" : "Save record"}
        </button>
      </form>
      {original && (
        <details className="staff-card">
          <summary>Delete this record</summary>
          <form action={remove} className="staff-form">
            {hidden}
            <label>
              <input
                type="checkbox"
                name="confirm"
                required
                disabled={deleting}
              />
              Permanently delete this record
            </label>
            {deleteError && (
              <p role="alert" className="staff-error">
                {deleteError}
              </p>
            )}
            <button className="button" disabled={deleting}>
              {deleting ? "Deleting…" : "Delete record"}
            </button>
          </form>
        </details>
      )}
    </>
  );
}
