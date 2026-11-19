"use client";
import { DepartmentBiography } from "@/components/admin/DepartmentBiography";
import { useActionState, useRef, useState } from "react";
import { saveOffice, deleteOffice } from "./actions";
import type { Office } from "@/lib/offices/permissions";
import { PublicationFields } from "@/components/admin/PublicationFields";
import { ImageUpload } from "@/components/admin/ImageUpload";
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
  const [branch, setBranch] = useState(office?.department || "executive");
  const selectedFiles = useRef<Record<string, File>>({});
  const [message, action, pending] = useActionState(
    async (state: string, form: FormData) => {
      for (const [name, file] of Object.entries(selectedFiles.current))
        form.set(name, file);
      return saveOffice(state, form);
    },
    "",
  );
  const [deleteMessage, remove, deleting] = useActionState(deleteOffice, "");
  const hidden = (
    <>
      <input type="hidden" name="id" value={office?.id || ""} />
      <input type="hidden" name="updated_at" value={office?.updated_at || ""} />
    </>
  );
  return (
    <>
      <form
        className="staff-form staff-card"
        action={action}
        onChange={(event) => {
          const input = event.target;
          if (input instanceof HTMLSelectElement && input.name === "department")
            setBranch(input.value as "executive" | "legislative");
          if (input instanceof HTMLInputElement && input.type === "file") {
            const file = input.files?.[0];
            if (file) selectedFiles.current[input.name] = file;
            else delete selectedFiles.current[input.name];
          }
        }}
      >
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
            required
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
          <textarea name="body" defaultValue={office?.body} maxLength={30000} />
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
        <DepartmentBiography initial={office?.head_description} />
        <ImageUpload
          name="department_image"
          label="Department Image"
          current={office?.image_url}
        />
        {office?.image_url && (
          <label>
            <input type="checkbox" name="remove_image" />
            Remove current department image
          </label>
        )}
        <ImageUpload
          name="photo"
          label="Department Head Photo"
          current={office?.head_photo}
          portrait
        />
        {office?.head_photo && (
          <label>
            <input type="checkbox" name="remove_photo" />
            Remove current head photo
          </label>
        )}
        <PublicationFields
          collection="departments"
          branch={branch}
          original={office?.id}
          published={office ? office.published : false}
          position={office?.sort_order}
        />
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
