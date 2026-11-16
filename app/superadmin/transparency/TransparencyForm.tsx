"use client";
import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { saveTransparency } from "./actions";
import {
  reportSlots,
  slotsFor,
  slotLabel,
  reportYears,
} from "@/lib/transparency/config";
import { PDF_LIMIT } from "@/lib/admin/document-pdf-validation";
export function TransparencyForm({
  kind,
  row = {},
  categories,
  currentYear,
}: {
  kind: "categories" | "documents";
  row?: Record<string, unknown>;
  categories: { id: string; name: string; published: boolean }[];
  currentYear: number;
}) {
  const category = kind === "categories";
  const [title, setTitle] = useState(String(row.name || row.title || ""));
  const [description, setDescription] = useState(String(row.description || ""));
  const [module, setModule] = useState(String(row.category_id || ""));
  const [frequency, setFrequency] = useState(
    String(row.report_frequency || "annual"),
  );
  const [year, setYear] = useState(String(row.report_year || currentYear));
  const [status, setStatus] = useState(row.published ? "published" : "draft");
  const [fileError, setFileError] = useState("");
  const files = useRef<Record<string, File>>({});
  const savedFiles = reportSlots.some((slot) => row[slot + "_pdf_path"]);
  const [error, action, pending] = useActionState(
    async (state: string, form: FormData) => {
      for (const slot of reportSlots) form.delete("pdf_" + slot);
      for (const slot of slotsFor(frequency)) {
        const file = files.current[slot];
        if (!file) continue;
        try {
          const response = await fetch("/admin/document-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scope: "transparency",
              original: row.id || "",
              size: file.size,
              type: file.type,
            }),
          });
          const result = await response.json();
          if (!response.ok) return result.error || "Unable to prepare upload.";
          const upload = await fetch(result.signedUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/pdf" },
            body: file,
          });
          if (!upload.ok) return slotLabel(slot) + " upload failed. Retry.";
          form.set("staged_" + slot, result.path);
        } catch {
          return "Cannot upload PDF. Check your connection and retry.";
        }
      }
      return saveTransparency(state, form);
    },
    "",
  );
  const back = category ? "/admin/transparency/modules" : "/admin/transparency";
  return (
    <form action={action} className="staff-form staff-card transparency-form">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="original" value={String(row.id || "")} />
      <input
        type="hidden"
        name="updated_at"
        value={String(row.updated_at || "")}
      />
      <fieldset disabled={pending}>
        <legend>{category ? "Module details" : "Report details"}</legend>
        {!category && (
          <label>
            Module
            <select
              name="category_id"
              required
              value={module}
              onChange={(e) => setModule(e.target.value)}
            >
              <option value="">Choose a module</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.published ? "" : " (unpublished)"}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {category ? "Module name" : "Report Title"}
          <input
            name="title"
            required
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        {!category && (
          <div className="transparency-form-grid">
            <label>
              Frequency
              <select
                name="report_frequency"
                value={frequency}
                disabled={savedFiles}
                onChange={(e) => {
                  setFrequency(e.target.value);
                  files.current = {};
                }}
              >
                <option value="annual">Annual</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </label>
            {savedFiles && (
              <input type="hidden" name="report_frequency" value={frequency} />
            )}
            <label>
              Year
              <select
                name="report_year"
                required
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                {reportYears(
                  currentYear,
                  Number(row.report_year) || undefined,
                ).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <label>
          Description
          <textarea
            name="description"
            rows={3}
            maxLength={10000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {!category && (
          <>
            <div>
              <h2>Attachments</h2>
              <p className="staff-note">
                PDF only, up to 10 MB each.{" "}
                {frequency === "quarterly"
                  ? "Upload available quarters now and add the rest later."
                  : "Upload one annual report."}
              </p>
            </div>
            <div className="transparency-uploads">
              {slotsFor(frequency).map((slot) => (
                <div className="transparency-upload" key={slot}>
                  <label>
                    {slotLabel(slot)}
                    <input
                      aria-label={slotLabel(slot) + " attachment"}
                      name={"pdf_" + slot}
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setFileError("");
                        delete files.current[slot];
                        if (
                          file &&
                          (!file.size ||
                            file.size > PDF_LIMIT ||
                            file.type !== "application/pdf")
                        ) {
                          e.target.value = "";
                          setFileError("Choose a PDF up to 10 MB.");
                        } else if (file) files.current[slot] = file;
                      }}
                    />
                  </label>
                  {!!row[slot + "_pdf_path"] && (
                    <>
                      <a
                        href={
                          "/admin/transparency/files/" +
                          row.id +
                          "?period=" +
                          slot
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        View current {slotLabel(slot)}
                      </a>
                      <label className="staff-note">
                        <input type="checkbox" name={"remove_" + slot} /> Remove{" "}
                        {slotLabel(slot)} (replacement takes priority)
                      </label>
                    </>
                  )}
                </div>
              ))}
            </div>
            {savedFiles && (
              <p className="staff-note">
                To change frequency, remove all attachments and save as a draft
                first.
              </p>
            )}
            <label>
              Status
              <select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
            <p className="staff-note">
              Drafts stay private. Published reports show only the PDFs already
              uploaded.
            </p>
          </>
        )}
        {(error || fileError) && <p role="alert">{fileError || error}</p>}
        <div className="staff-actions">
          <button
            className="button button-blue"
            disabled={pending || !!fileError}
          >
            {pending ? "Saving…" : category ? "Save module" : "Save report"}
          </button>
          <Link className="button" href={back}>
            Cancel
          </Link>
        </div>
      </fieldset>
    </form>
  );
}
