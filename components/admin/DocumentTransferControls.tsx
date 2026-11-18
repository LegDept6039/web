"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { importLegislativeDocuments } from "@/app/admin/document-transfer/actions";
import { documentTypes, type DocumentType } from "@/lib/legislative/config";

export interface DocumentTransferOffice {
  id: string;
  name: string;
  writable: boolean;
}

export function DocumentTransferControls({
  offices,
  office,
  type,
}: {
  offices: DocumentTransferOffice[];
  office?: string;
  type?: DocumentType;
}) {
  const [mode, setMode] = useState<"import" | "export" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    if (mode && !dialog.current?.open) dialog.current?.showModal();
    else if (!mode && dialog.current?.open) dialog.current.close();
  }, [mode]);
  if (!offices.length) return null;
  return (
    <div className="document-transfer-controls">
      {offices.some((o) => o.writable) && (
        <button
          type="button"
          className="button document-transfer-button"
          onClick={() => setMode("import")}
        >
          <Upload size={16} aria-hidden="true" /> Import CSV
        </button>
      )}
      <button
        type="button"
        className="button document-transfer-button"
        onClick={() => setMode("export")}
      >
        <Download size={16} aria-hidden="true" /> Export CSV
      </button>
      <dialog
        ref={dialog}
        className="document-transfer-dialog"
        aria-labelledby={heading}
        onClose={() => setMode(null)}
      >
        {mode && (
          <TransferForm
            key={mode}
            mode={mode}
            heading={heading}
            offices={offices}
            office={office}
            type={type}
            close={() => dialog.current?.close()}
          />
        )}
      </dialog>
    </div>
  );
}

function TransferForm({
  mode,
  heading,
  offices,
  office,
  type,
  close,
}: {
  mode: "import" | "export";
  heading: string;
  offices: DocumentTransferOffice[];
  office?: string;
  type?: DocumentType;
  close: () => void;
}) {
  const [selectedOffice, setSelectedOffice] = useState(
    offices.find((o) => o.id === office)?.id || offices[0].id,
  );
  const [selectedType, setSelectedType] = useState<DocumentType>(
    type || "ordinance",
  );
  const [result, action, pending] = useActionState(importLegislativeDocuments, {
    ok: false,
    message: "",
  });
  const resultPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result.message) resultPanel.current?.focus();
  }, [result]);
  const url = `/admin/document-transfer/export?${new URLSearchParams({ office: selectedOffice, type: selectedType })}`;
  const writable = offices.find((o) => o.id === selectedOffice)?.writable;
  return (
    <>
      <div className="document-transfer-heading">
        <h2 id={heading}>
          {mode === "import" ? "Import" : "Export"} Legislative Documents
        </h2>
        <button
          type="button"
          className="document-transfer-close"
          onClick={close}
          aria-label="Close dialog"
          disabled={pending}
        >
          <X size={20} />
        </button>
      </div>
      <p className="staff-note">
        {mode === "import"
          ? "Add new published records from a CSV file. Use Edit to update existing documents."
          : "Download all published records of one document type in this office, across all Legislative Terms."}
      </p>
      <form
        className="staff-form"
        action={mode === "import" ? action : undefined}
        onReset={(event) => event.preventDefault()}
        onSubmit={
          mode === "export" ? (event) => event.preventDefault() : undefined
        }
      >
        {offices.length > 1 ? (
          <label>
            Office
            <select
              name="office"
              value={selectedOffice}
              onChange={(event) => setSelectedOffice(event.target.value)}
              disabled={pending}
            >
              {offices.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <input type="hidden" name="office" value={selectedOffice} />
            <p className="staff-note">{offices[0].name}</p>
          </>
        )}
        <label>
          Document Type
          <select
            name="type"
            value={selectedType}
            onChange={(event) =>
              setSelectedType(event.target.value as DocumentType)
            }
            disabled={pending}
          >
            {Object.entries(documentTypes).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {mode === "import" ? (
          <>
            <div className="document-transfer-links">
              <a href={`${url}&template=1`} download>
                Download CSV Template
              </a>
              {selectedType !== "executive-order" && (
                <a href={`${url}&references=1`} download>
                  Download Reference IDs
                </a>
              )}
            </div>
            <label>
              CSV File
              <input
                type="file"
                name="file"
                accept=".csv,text/csv"
                required
                disabled={pending}
              />
            </label>
            <p className="staff-note">
              Up to 100 records and 2 MB per file. Use YYYY-MM-DD dates.
              {selectedType === "ordinance" || selectedType === "resolution"
                ? " A number, author, committee and session are required. Use Reference IDs for records in the same term."
                : selectedType === "executive-order"
                  ? " The issuance date determines the Legislative Term."
                  : " A session ID is required. Use Reference IDs to find the session."}
            </p>
            <p className="staff-note">
              Leave id blank. Attach PDFs through Edit after importing;
              attachment_url is reference-only.
            </p>
            {!writable && (
              <p role="alert">You have read-only access to this office.</p>
            )}
            {result.message && (
              <div
                ref={resultPanel}
                tabIndex={-1}
                role={result.ok ? "status" : "alert"}
                className="document-transfer-result"
              >
                <p>{result.message}</p>
                {result.errors?.length ? (
                  <ul>
                    {result.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                ) : null}
                {result.ok && (
                  <p>
                    Use the Legislative Term filter in Documents to find records
                    from previous terms.
                  </p>
                )}
              </div>
            )}
            <button
              className="button button-blue"
              disabled={pending || !writable}
            >
              {pending ? "Importing..." : "Import Records"}
            </button>
          </>
        ) : (
          <>
            <p className="staff-note">
              The CSV includes record and relationship IDs, text fields, and
              attachment links. It does not contain PDF files. IDs and
              attachment links are read-only references when importing.
            </p>
            <a className="button button-blue" href={url} download>
              Download CSV
            </a>
          </>
        )}
      </form>
    </>
  );
}
