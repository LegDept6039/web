"use client";
import Link from "next/link";
import type { LegislativeOptions } from "@/lib/legislative/config";
import { termDisplayName, termForDate } from "@/lib/legislative/terms";
import { legislativeRoles } from "@/lib/officials/roles";
import { ImageEditOverlay } from "./ImageEditOverlay";

export function OfficialEditorFields({
  row,
  editable,
  options,
}: {
  row: Record<string, unknown>;
  editable: boolean;
  options: LegislativeOptions;
}) {
  const value = (key: string) => String(row[key] || "");
  const term =
    value("term_id") ||
    (row.id ? "" : termForDate(options.terms || [], options.today || "")?.id) ||
    "";
  return (
    <div className="department-page-editor official-page-editor">
      <header className="department-editor-hero">
        <span className="eyebrow">SANGGUNIANG BAYAN</span>
        <h2>{value("name") || "New Legislative Official"}</h2>
        <p className="staff-note">
          Edit the portrait and information shown in the council directory.
        </p>
        {Boolean(row.id) && (
          <p className="staff-note">
            Record ID: <span className="break-all">{value("id")}</span>
          </p>
        )}
        {row.published === true && (
          <Link
            className="text-link"
            href={`/legislative/members?term=${encodeURIComponent(value("term_id") || "unassigned")}`}
          >
            View Council Directory
          </Link>
        )}
      </header>
      <section
        className="department-editor-profile"
        aria-label="Official portrait and profile"
      >
        <ImageEditOverlay
          name="photo"
          removeName="remove_photo"
          current={value("photo_url")}
          label="Profile photo"
          portrait
          editable={editable}
        />
        <div className="department-editor-fields">
          <label>
            Legislative Term
            <select name="term_id" required defaultValue={term}>
              <option value="">Select a term</option>
              {(options.terms || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {termDisplayName(t, options.today)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input
              className="department-editor-name"
              name="name"
              required
              defaultValue={value("name")}
            />
          </label>
          <label>
            Official role
            <select
              name="legislative_role"
              required
              defaultValue={value("legislative_role")}
            >
              <option value="">Select a role...</option>
              {Object.entries(legislativeRoles)
                .filter(
                  ([role]) =>
                    role !== "SECRETARY_TO_THE_SANGGUNIANG_BAYAN" ||
                    row.legislative_role === role,
                )
                .map(([role, label]) => (
                  <option key={role} value={role}>
                    {role === "MUNICIPAL_VICE_MAYOR"
                      ? "Vice-Mayor"
                      : role === "SANGGUNIANG_BAYAN"
                        ? "Sangguniang Bayan Member"
                        : label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Description
            <textarea
              name="description"
              required
              rows={5}
              defaultValue={value("description")}
            />
          </label>
          <p className="staff-note">
            Each new line is preserved in the public profile.
          </p>
        </div>
      </section>
    </div>
  );
}
