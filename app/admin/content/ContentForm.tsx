"use client";
import Image from "next/image";
import { useActionState, useState, useEffect } from "react";
import { legislativeRoles } from "@/lib/officials/roles";
import type { Office } from "@/lib/offices/permissions";
import { definitions, type Collection } from "@/lib/content/schema";
import { label } from "@/lib/admin/content";
import { saveContent, deleteContent } from "./actions";
export function ContentForm({
  collection,
  row = {},
  offices,
  canWrite = true,
  canDelete = false,
  superadmin = false,
  scope = "executive",
}: {
  collection: Collection;
  row?: Record<string, unknown>;
  offices: Office[];
  canWrite?: boolean;
  canDelete?: boolean;
  superadmin?: boolean;
  scope?: "legislative" | "executive";
}) {
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, action, pending] = useActionState(
    async (state: string, form: FormData) => {
      const file = form.get("news_image");
      form.delete("news_image"); // Image bytes go directly to Storage, never through a Server Action.
      if (collection === "news" && file instanceof File && file.size) {
        try {
          if (
            file.size > 10 * 1024 * 1024 ||
            !["image/jpeg", "image/png"].includes(file.type)
          )
            return "Choose a JPG or PNG image up to 10 MB.";
          setUploadStatus("Uploading image...");
          const officeId =
            scope === "legislative"
              ? offices.find((o) => o.department === "legislative")?.id
              : form.get("office_id");
          const response = await fetch("/admin/news-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              officeId,
              original: form.get("original"),
              type: file.type,
              size: file.size,
            }),
          });
          const upload = await response.json();
          if (!response.ok)
            throw new Error(upload.error || "Unable to prepare image upload.");
          const result = await fetch(upload.signedUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!result.ok) throw new Error("Image upload failed. Please retry.");
          form.set("news_upload_path", upload.path);
          setUploadStatus("Validating image and saving record...");
        } catch (error) {
          setUploadStatus("");
          return error instanceof Error ? error.message : "Upload failed.";
        }
      }
      const result = await saveContent(state, form);
      setUploadStatus("");
      return result;
    },
    "",
  );
  const [deleteError, remove, deleting] = useActionState(deleteContent, "");
  const [preview, setPreview] = useState<string>();
  const [photoError, setPhotoError] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const definition = definitions[collection];
  const photoColumn = collection === "departments" ? "head_photo" : "photo_url";
  const [departmentPreview, setDepartmentPreview] = useState<string>();
  useEffect(
    () => () => {
      if (departmentPreview) URL.revokeObjectURL(departmentPreview);
    },
    [departmentPreview],
  );
  const original = String(row[definition.key] || "");
  const hidden = (
    <>
      <input type="hidden" name="content_scope" value={scope} />
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
        <fieldset disabled={!canWrite || pending}>
          <legend>{canWrite ? "Record details" : "View only"}</legend>
          {scope === "executive" &&
          !superadmin &&
          (original || offices.length === 1) ? (
            <p>
              Owning office:{" "}
              {
                offices.find((o) => o.id === (row.office_id || offices[0]?.id))
                  ?.name
              }
              <input
                type="hidden"
                name="office_id"
                value={String(row.office_id || offices[0]?.id || "")}
              />
            </p>
          ) : (
            scope === "executive" && (
              <label>
                Owning office
                <select
                  name="office_id"
                  defaultValue={String(row.office_id || "")}
                  required={!superadmin}
                  disabled={Boolean(original) && !superadmin}
                >
                  <option value="">Unassigned (Super Admin only)</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                      {o.active ? "" : " (inactive)"}
                    </option>
                  ))}
                </select>
              </label>
            )
          )}
          {["officials", "departments"].includes(collection) && (
            <>
              {original && <p className="staff-note">Record ID: {original}</p>}
              {collection === "officials" && scope === "legislative" && (
                <label>
                  Official role
                  <select
                    name="legislative_role"
                    required
                    defaultValue={String(row.legislative_role || "")}
                  >
                    <option value="">Select a role...</option>
                    {Object.entries(legislativeRoles).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Profile picture (JPEG, PNG, WebP; up to 2 MB)
                <input
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setPhotoError("");
                    if (
                      file &&
                      (file.size > 2 * 1024 * 1024 ||
                        !["image/jpeg", "image/png", "image/webp"].includes(
                          file.type,
                        ))
                    ) {
                      event.target.value = "";
                      setPreview(undefined);
                      setPhotoError(
                        "Choose a JPEG, PNG, or WebP image up to 2 MB.",
                      );
                      return;
                    }
                    setPreview(file ? URL.createObjectURL(file) : undefined);
                  }}
                />
              </label>
              {preview || row[photoColumn] ? (
                <div className="official-upload-preview">
                  <Image
                    unoptimized
                    width={180}
                    height={180}
                    key={preview || String(row[photoColumn])}
                    src={preview || String(row[photoColumn])}
                    alt="Profile photo preview"
                    onError={(e) => {
                      e.currentTarget.hidden = true;
                      setPhotoError(
                        "Preview unavailable. You can select a replacement image.",
                      );
                    }}
                  />
                </div>
              ) : (
                <p className="staff-note">
                  No photo selected. A profile silhouette will be shown.
                </p>
              )}
              {photoError && <p role="alert">{photoError}</p>}
              {Boolean(row[photoColumn]) && (
                <label>
                  <input name="remove_photo" type="checkbox" />
                  Remove current photo (a selected replacement takes priority)
                </label>
              )}
            </>
          )}
          {collection === "departments" && (
            <label>
              Department image (JPEG, PNG, WebP; up to 2 MB)
              <input
                type="file"
                name="department_image"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setDepartmentPreview(
                    file ? URL.createObjectURL(file) : undefined,
                  );
                }}
              />
              {Boolean(departmentPreview || row.image_url) && (
                <Image
                  unoptimized
                  width={240}
                  height={160}
                  src={departmentPreview || String(row.image_url)}
                  alt="Department image preview"
                />
              )}
              {Boolean(row.image_url) && (
                <span>
                  <input type="checkbox" name="remove_image" /> Remove
                  department image
                </span>
              )}
            </label>
          )}
          {collection === "news" && (
            <>
              <label>
                Featured image (JPG, JPEG, PNG; up to 10 MB)
                <input
                  name="news_image"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setPhotoError("");
                    if (
                      file &&
                      (file.size > 10 * 1024 * 1024 ||
                        !["image/jpeg", "image/png"].includes(file.type))
                    ) {
                      event.target.value = "";
                      setPreview(undefined);
                      setPhotoError("Choose a JPG or PNG image up to 10 MB.");
                      return;
                    }
                    setPreview(file ? URL.createObjectURL(file) : undefined);
                  }}
                />
              </label>
              {Boolean(preview || row.image) && (
                <Image
                  unoptimized
                  width={300}
                  height={200}
                  src={preview || String(row.image)}
                  alt="News image preview"
                />
              )}
              {photoError && <p role="alert">{photoError}</p>}
            </>
          )}
          {Object.entries(definition.fields).map(([name, field]) => {
            if (
              ["officeId", "contentScope", "headPhoto", "imageUrl"].includes(
                name,
              )
            )
              return null;
            if (
              ["contacts", "news", "programs"].includes(collection) &&
              name === "id"
            )
              return original ? (
                <input key={name} type="hidden" name="id" value={original} />
              ) : null;
            if (collection === "news" && name === "image") return null;
            if (
              collection === "departments" &&
              ["name", "acronym", "slug", "active", "isSample"].includes(name)
            )
              return null;
            if (
              collection === "officials" &&
              (["id", "photoUrl", "legislativeRole", "branch"].includes(name) ||
                (scope === "legislative" && name === "role"))
            )
              return null;
            const value = row[field.column];
            const required =
              !field.optional || (collection === "programs" && name === "slug");
            const props = {
              name: field.column,
              required,
              defaultValue: value == null ? "" : String(value),
            };
            return (
              <label key={name}>
                {label(name)}
                {!required ? " (optional)" : ""}
                {field.kind === "boolean" ? (
                  <input
                    type="checkbox"
                    name={field.column}
                    defaultChecked={value === true}
                  />
                ) : field.values ? (
                  <select {...props}>
                    <option value="">Select...</option>
                    {field.values.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                ) : field.kind === "list" ? (
                  <>
                    <textarea
                      {...props}
                      defaultValue={
                        Array.isArray(value) ? value.join("\n") : ""
                      }
                    />
                    <span className="staff-note">
                      One item or paragraph per line.
                    </span>
                  </>
                ) : [
                    "body",
                    "headDescription",
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
          {collection !== "departments" && (
            <>
              <label>
                Sort order
                <input
                  name="sort_order"
                  type="number"
                  step="1"
                  defaultValue={Number(row.sort_order || 0)}
                />
              </label>
              <label>
                <input
                  name="published"
                  type="checkbox"
                  defaultChecked={row.published === true}
                />
                Published — visible on the public website
              </label>
            </>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="staff-error">
            {error}
          </p>
        )}
        {uploadStatus && <p role="status">{uploadStatus}</p>}
        {canWrite && (
          <button className="button button-blue" disabled={pending}>
            {pending ? "Saving..." : "Save record"}
          </button>
        )}
      </form>
      {original && canDelete && (
        <details className="staff-card">
          <summary>Delete this record</summary>
          <form action={remove} className="staff-form">
            {hidden}
            <label>
              <input type="checkbox" name="confirm" required />
              Permanently delete this record
            </label>
            {deleteError && <p role="alert">{deleteError}</p>}
            <button className="button" disabled={deleting}>
              {deleting ? "Deleting..." : "Delete record"}
            </button>
          </form>
        </details>
      )}
    </>
  );
}
