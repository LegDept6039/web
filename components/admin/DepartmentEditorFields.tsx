"use client";
import Link from "next/link";
import { DepartmentBiography } from "./DepartmentBiography";
import { ImageEditOverlay } from "./ImageEditOverlay";
export function DepartmentEditorFields({
  row,
  editable,
}: {
  row: Record<string, unknown>;
  editable: boolean;
}) {
  const value = (key: string) => String(row[key] || "");
  const isBranch = Boolean(row.parent_department_id);
  return (
    <div className="department-page-editor">
      <input type="hidden" name="id" value={value("id")} />
      <header className="department-editor-hero">
        <span className="eyebrow">
          {value("short_name") || "MUNICIPAL DEPARTMENT"}
        </span>
        <h2>{value("name")}</h2>
        <p className="staff-note">
          Edit the head, description, body, and picture for this{" "}
          {isBranch ? "branch" : "department"}.
        </p>
        {row.published === true && row.active !== false && row.slug ? (
          <Link className="text-link" href={`/departments/${value("slug")}`}>
            View published {isBranch ? "branch" : "department"} page
          </Link>
        ) : null}
      </header>
      <section
        className="department-editor-profile"
        aria-label="Department head and overview"
      >
        <ImageEditOverlay
          name="photo"
          removeName="remove_photo"
          current={value("head_photo")}
          label="Profile photo"
          portrait
          editable={editable}
        />
        <div className="department-editor-fields">
          <label>
            Head Title (optional)
            <input name="head_title" defaultValue={value("head_title")} />
          </label>
          <label>
            Head Name (optional)
            <input
              className="department-editor-name"
              name="head_name"
              defaultValue={value("head_name")}
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              defaultValue={value("description")}
              required
              rows={4}
            />
          </label>
          <DepartmentBiography
            initial={value("head_description")}
            label="Head Description (optional)"
          />
        </div>
      </section>
      <section
        className="department-editor-about"
        aria-labelledby="department-about-label"
      >
        <h2 id="department-about-label">
          {isBranch ? "About the Branch" : "About the Department"}
        </h2>
        <label>
          Body (optional)
          <textarea name="body" defaultValue={value("body")} rows={10} />
        </label>
      </section>
      <section
        className="department-editor-image"
        aria-label="Department card image"
      >
        <div>
          <h2>{isBranch ? "Branch image" : "Department image"}</h2>
          <p className="staff-note">
            {isBranch
              ? "Shown on the branch page and in the Branches directory."
              : "Public department cards and pages use the head portrait above."}
          </p>
        </div>
        <ImageEditOverlay
          name="department_image"
          removeName="remove_image"
          current={value("image_url")}
          label={isBranch ? "Branch image" : "Department image"}
          editable={editable}
        />
      </section>
    </div>
  );
}
