"use client";
import { termDisplayName, termForDate } from "@/lib/legislative/terms";
import { LegislativeFields } from "@/components/admin/LegislativeFields";
import { PdfAttachment } from "@/components/admin/PdfAttachment";
import { PDF_LIMIT } from "@/lib/admin/document-pdf-validation";
import {
  emptyOptions,
  usesLegislativeFields,
  isDocumentCollection,
  type LegislativeOptions,
} from "@/lib/legislative/config";
import { DepartmentEditorFields } from "@/components/admin/DepartmentEditorFields";
import dynamic from "next/dynamic";
import { PublicationFields } from "@/components/admin/PublicationFields";
import {
  legacyDocument,
  richTextPlain,
  validateRichText,
  type RichNode,
} from "@/lib/content/rich-text";
import Image from "next/image";
import { useActionState, useState, useEffect, useRef } from "react";
import { legislativeRoles } from "@/lib/officials/roles";
import type { Office } from "@/lib/offices/permissions";
import { definitions, type Collection } from "@/lib/content/schema";
import { label } from "@/lib/admin/content";
import { saveContent, deleteContent } from "./actions";
const RichTextEditor = dynamic(
  () => import("@/components/admin/RichTextEditor"),
  { ssr: false },
);
export function ContentForm({
  collection,
  row = {},
  offices,
  canWrite = true,
  canDelete = false,
  superadmin = false,
  scope = "executive",
  legislativeOptions = emptyOptions,
}: {
  legislativeOptions?: LegislativeOptions;
  collection: Collection;
  row?: Record<string, unknown>;
  offices: Office[];
  canWrite?: boolean;
  canDelete?: boolean;
  superadmin?: boolean;
  scope?: "legislative" | "executive";
}) {
  // React resets native file inputs after an action, including validation errors.
  // Keep the selected bytes with the preview so a retry cannot silently omit them.
  const [selectedOffice, setSelectedOffice] = useState(
    String(
      row.office_id ||
        (scope === "legislative"
          ? offices.find((o) => o.department === "legislative")?.id
          : offices.length === 1
            ? offices[0].id
            : "") ||
        "",
    ),
  );
  const [initialRich] = useState<RichNode>(
    () =>
      (row.rich_body as RichNode) ||
      legacyDocument(
        collection === "news"
          ? Array.isArray(row.content)
            ? row.content
            : []
          : String(row.description || ""),
      ),
  );
  const rich = useRef(initialRich);
  const selectedFiles = useRef<Record<string, File>>({});
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, action, pending] = useActionState(
    async (state: string, form: FormData) => {
      if (["news", "programs"].includes(collection)) {
        try {
          const doc = validateRichText(rich.current, true);
          form.set("rich_body", JSON.stringify(doc));
          if (collection === "news") form.set("content", richTextPlain(doc));
        } catch (error) {
          return error instanceof Error ? error.message : "Invalid content.";
        }
      }
      for (const [name, file] of Object.entries(selectedFiles.current))
        form.set(name, file);
      const pdf = form.get("document_pdf");
      form.delete("document_pdf");
      if (
        scope === "legislative" &&
        isDocumentCollection(collection) &&
        pdf instanceof File &&
        pdf.size
      ) {
        try {
          if (pdf.size > PDF_LIMIT || pdf.type !== "application/pdf")
            return "Choose a PDF up to 10 MB.";
          setUploadStatus("Uploading PDF...");
          const response = await fetch("/admin/document-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              collection,
              officeId: offices.find((o) => o.department === "legislative")?.id,
              original: form.get("original"),
              type: pdf.type,
              size: pdf.size,
            }),
          });
          const upload = await response.json();
          if (!response.ok)
            throw new Error(upload.error || "Unable to prepare PDF upload.");
          const result = await fetch(upload.signedUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/pdf" },
            body: pdf,
          });
          if (!result.ok) throw new Error("PDF upload failed. Please retry.");
          form.set("document_upload_path", upload.path);
          setUploadStatus("Checking PDF and saving document...");
        } catch (error) {
          setUploadStatus("");
          return error instanceof Error ? error.message : "PDF upload failed.";
        }
      }
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
  const legislative =
    scope === "legislative" && usesLegislativeFields(collection);
  const definition = definitions[collection];
  const photoColumn = "photo_url";
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
      <form
        className={`staff-form staff-card${collection === "departments" ? " department-edit-form" : ""}`}
        action={action}
        onChange={(event) => {
          const input = event.target;
          if (input instanceof HTMLSelectElement && input.name === "office_id")
            setSelectedOffice(input.value);
          if (input instanceof HTMLInputElement && input.type === "file") {
            const file = input.files?.[0];
            if (file) selectedFiles.current[input.name] = file;
            else delete selectedFiles.current[input.name];
          }
        }}
      >
        {hidden}
        <fieldset disabled={!canWrite || pending}>
          <legend>
            {canWrite
              ? collection === "departments"
                ? "Department page and head"
                : "Record details"
              : "View only"}
          </legend>
          {scope === "executive" &&
          ((collection === "departments" && original) ||
            (!superadmin && (original || offices.length === 1))) ? (
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
                  required={
                    ["news", "programs", "departments", "contacts"].includes(
                      collection,
                    ) || !superadmin
                  }
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
          {collection === "officials" && (
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
                    {Object.entries(legislativeRoles)
                      .filter(
                        ([value]) =>
                          value !== "SECRETARY_TO_THE_SANGGUNIANG_BAYAN" ||
                          row.legislative_role === value,
                      )
                      .map(([value, label]) => (
                        <option key={value} value={value}>
                          {value === "MUNICIPAL_VICE_MAYOR"
                            ? "Vice-Mayor"
                            : value === "SANGGUNIANG_BAYAN"
                              ? "Sangguniang Bayan Member"
                              : label}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                Profile picture (JPEG, PNG, WebP; up to 10 MB)
                <input
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setPhotoError("");
                    if (
                      file &&
                      (file.size > 10 * 1024 * 1024 ||
                        !["image/jpeg", "image/png", "image/webp"].includes(
                          file.type,
                        ))
                    ) {
                      event.target.value = "";
                      setPreview(undefined);
                      setPhotoError(
                        "Choose a JPEG, PNG, or WebP image up to 10 MB.",
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
            <DepartmentEditorFields row={row} editable={canWrite} />
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
          {legislative && isDocumentCollection(collection) && (
            <p className="staff-note">
              Valid documents are published when saved.
            </p>
          )}
          {scope === "legislative" && collection === "officials" && (
            <label>
              Legislative Term
              <select
                name="term_id"
                required
                defaultValue={String(
                  row.term_id ||
                    (row.id
                      ? ""
                      : termForDate(
                          legislativeOptions.terms || [],
                          legislativeOptions.today || "",
                        )?.id) ||
                    "",
                )}
              >
                <option value="">Select a term</option>
                {(legislativeOptions.terms || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {termDisplayName(t, legislativeOptions.today)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {legislative && (
            <LegislativeFields
              collection={collection}
              row={row}
              options={legislativeOptions}
            />
          )}
          {legislative && isDocumentCollection(collection) && (
            <PdfAttachment
              url={String(
                row[collection === "documents" ? "file_url" : "pdf_url"] || "",
              )}
            />
          )}
          {Object.entries(definition.fields).map(([name, field]) => {
            if (
              [
                "reportFrequency",
                "reportYear",
                "annualPdfPath",
                "q1PdfPath",
                "q2PdfPath",
                "q3PdfPath",
                "q4PdfPath",
              ].includes(name)
            )
              return null;
            if (name === "termId") return null;
            if (legislative) return null;
            if (scope === "legislative" && name === "isSample") return null;
            if (collection === "departments") return null;
            if (
              [
                "officeId",
                "contentScope",
                "headPhoto",
                "imageUrl",
                "attachmentPath",
              ].includes(name)
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
            if (collection === "news" && name === "content")
              return (
                <div key={name}>
                  <p className="required-field-title">
                    Content <span aria-hidden="true">*</span>
                  </p>
                  <RichTextEditor
                    initial={initialRich}
                    legacy={[]}
                    disabled={!canWrite || pending}
                    onChange={(doc) => {
                      rich.current = doc;
                    }}
                  />
                </div>
              );
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
          {collection === "programs" && (
            <div>
              <p className="required-field-title">
                Body <span aria-hidden="true">*</span>
              </p>
              <RichTextEditor
                label="Body"
                initial={initialRich}
                legacy={[]}
                disabled={!canWrite || pending}
                onChange={(doc) => {
                  rich.current = doc;
                }}
              />
            </div>
          )}
          {collection !== "departments" &&
            !(legislative && isDocumentCollection(collection)) && (
              <PublicationFields
                collection={collection}
                office={selectedOffice}
                branch={scope}
                original={String(row.id || "")}
                published={row.published === true}
                position={Number(row.sort_order || 0)}
              />
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
