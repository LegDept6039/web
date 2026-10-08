"use client";
import { useActionState } from "react";
import { saveOffice, deleteOffice } from "./actions";
import type { Office } from "@/lib/offices/permissions";
export function OfficeForm({
  office,
}: {
  office?: Office & {
    body?: string;
    head_name?: string;
    head_title?: string;
    head_description?: string;
    head_photo?: string;
    image_url?: string;
    published?: boolean;
    sort_order?: number;
  };
}) {
  const [message, action, pending] = useActionState(saveOffice, "");
  const [deleteMessage, remove, deleting] = useActionState(deleteOffice, "");
  const hidden = (
    <>
      <input type="hidden" name="id" value={office?.id || ""} />
      <input type="hidden" name="updated_at" value={office?.updated_at || ""} />
    </>
  );
  return (
    <>
      <form className="staff-form staff-card" action={action}>
        {hidden}
        <label>
          Department name
          <input
            name="name"
            required
            maxLength={160}
            defaultValue={office?.name}
          />
        </label>
        <label>
          Acronym
          <input
            name="short_name"
            maxLength={40}
            defaultValue={office?.short_name}
          />
        </label>
        <label>
          Slug
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            defaultValue={office?.slug}
          />
        </label>
        <label>
          Branch
          <select
            name="department"
            defaultValue={office?.department || "executive"}
            disabled={Boolean(office)}
          >
            <option value="executive">Executive</option>
            <option value="legislative">Legislative</option>
          </select>
        </label>
        {office && (
          <input type="hidden" name="department" value={office.department} />
        )}
        <label>
          Short description
          <textarea
            name="description"
            maxLength={10000}
            defaultValue={office?.description}
          />
        </label>
        <label>
          Body / About content
          <textarea
            name="body"
            defaultValue={office?.body}
            maxLength={30000}
          />
        </label>
        <label>
          Department Head Name
          <input
            name="head_name"
            defaultValue={office?.head_name || ""}
            maxLength={300}
          />
        </label>
        <label>
          Department Head Title
          <input
            name="head_title"
            defaultValue={office?.head_title || ""}
            maxLength={300}
          />
        </label>
        <label>
          Department Head Description
          <textarea
            name="head_description"
            defaultValue={office?.head_description}
            maxLength={10000}
          />
        </label>
        <label>
          Department Image (JPEG, PNG, WebP; up to 2 MB)
          <input
            type="file"
            name="department_image"
            accept="image/jpeg,image/png,image/webp"
          />
        </label>
        {office?.image_url && (
          <label>
            <input type="checkbox" name="remove_image" />
            Remove current department image
          </label>
        )}
        <label>
          Department Head Photo (JPEG, PNG, WebP; up to 2 MB)
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
          />
        </label>
        {office?.head_photo && (
          <label>
            <input type="checkbox" name="remove_photo" />
            Remove current head photo
          </label>
        )}
        <label>
          Display Order
          <input
            type="number"
            name="sort_order"
            step="1"
            defaultValue={office?.sort_order || 0}
            required
          />
        </label>
        <label>
          <input
            type="checkbox"
            name="published"
            defaultChecked={office ? office.published : true}
          />
          Published
        </label>
        <label>
          <input
            type="checkbox"
            name="active"
            defaultChecked={office ? office.active : true}
          />
          Active
        </label>
        <p>
          Deactivating a department removes staff access and hides its public
          department page. Content and assignments are preserved.
        </p>
        {message && <p role="alert">{message}</p>}
        <button className="button button-blue" disabled={pending}>
          {pending ? "Saving..." : "Save department"}
        </button>
      </form>
      {office && (
        <details className="staff-card">
          <summary>Deactivate department</summary>
          <form className="staff-form" action={remove}>
            {hidden}
            <p>
              This preserves staff assignments, news, programs, contacts, and
              media.
            </p>
            <label>
              <input type="checkbox" name="confirm" required />
              Deactivate this department
            </label>
            {deleteMessage && <p role="alert">{deleteMessage}</p>}
            <button className="button" disabled={deleting}>
              Deactivate department
            </button>
          </form>
        </details>
      )}
    </>
  );
}
