"use client";
import { useState } from "react";
import { PDF_LIMIT } from "@/lib/admin/document-pdf-validation";

export function PdfAttachment({
  url,
  privateDraft = false,
}: {
  url: string;
  privateDraft?: boolean;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <div>
      <label>
        PDF attachment (optional, up to 10 MB)
        <input
          aria-label="PDF attachment"
          type="file"
          name="document_pdf"
          accept="application/pdf,.pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setError("");
            if (
              file &&
              (!file.size ||
                file.size > PDF_LIMIT ||
                file.type !== "application/pdf")
            ) {
              event.target.value = "";
              setName("");
              setError("Choose a PDF up to 10 MB.");
            } else setName(file?.name || "");
          }}
        />
      </label>
      {name && <p className="staff-note">Selected PDF: {name}</p>}
      {error && <p role="alert">{error}</p>}
      {url && (
        <p>
          <a href={url} target="_blank" rel="noreferrer">
            View current PDF
          </a>
        </p>
      )}
      <p className="staff-note">
        {url
          ? "Choose a file to replace the current PDF, or leave this empty to keep it. "
          : ""}
        {privateDraft
          ? "A PDF is required to publish. Draft attachments remain private."
          : "The attachment will be publicly available when saved."}
      </p>
    </div>
  );
}
