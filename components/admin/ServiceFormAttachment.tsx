"use client";

import { useId, useState } from "react";
import { PDF_LIMIT } from "@/lib/admin/document-pdf-validation";
import { serviceFormName } from "@/lib/admin/service-form-validation";

export function ServiceFormAttachment({
  id,
  name,
  hasAttachment,
}: {
  id: string;
  name: string;
  hasAttachment: boolean;
}) {
  const helpId = useId();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  return (
    <div>
      <label>
        Service form (optional PDF, up to 10 MB)
        <input
          type="file"
          name="service_form_pdf"
          aria-label="Service form PDF"
          aria-describedby={helpId}
          accept="application/pdf,.pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setError("");
            try {
              if (file) {
                if (
                  !file.size ||
                  file.size > PDF_LIMIT ||
                  file.type !== "application/pdf"
                )
                  throw new Error("Choose a PDF up to 10 MB.");
                serviceFormName(file.name);
              }
              setSelected(file?.name || "");
            } catch (error) {
              event.target.value = "";
              setSelected("");
              setError(
                error instanceof Error ? error.message : "Choose a PDF file.",
              );
            }
          }}
        />
      </label>
      {selected && <p className="staff-note">Selected PDF: {selected}</p>}
      {error && <p role="alert">{error}</p>}
      {hasAttachment && id && (
        <>
          <p>
            <a
              href={`/admin/service-forms/${encodeURIComponent(id)}`}
              target="_blank"
              rel="noreferrer"
            >
              View current form{name ? `: ${name}` : ""}
            </a>
          </p>
          <label className="staff-checkbox">
            <input type="checkbox" name="remove_service_form" />
            Remove current form from this service
          </label>
        </>
      )}
      <p id={helpId} className="staff-note">
        Attach the blank form visitors need for this service.{" "}
        {hasAttachment ? "Leave the file empty to keep the current form. " : ""}
        Draft forms remain private; visitors can download the form after the
        service and its department are published.
      </p>
    </div>
  );
}
