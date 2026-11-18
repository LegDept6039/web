"use server";
import { revalidatePath } from "next/cache";
import { officeContext } from "@/lib/offices/server";
import { definitions } from "@/lib/content/schema";
import { documentCollection } from "@/lib/legislative/config";
import {
  DOCUMENT_CSV_MAX_BYTES,
  parseDocumentCsv,
} from "@/lib/legislative/document-csv";
import {
  authorizeDocumentTransfer,
  prepareDocumentImport,
  DocumentTransferError,
  type DocumentImportResult,
} from "@/lib/legislative/document-transfer";

export async function importLegislativeDocuments(
  _state: DocumentImportResult,
  form: FormData,
): Promise<DocumentImportResult> {
  // Preserve the existing login/session redirect rather than catching it as a CSV error.
  const context = await officeContext(true);
  try {
    const officeId = String(form.get("office") || "");
    const type = authorizeDocumentTransfer(
      context,
      officeId,
      String(form.get("type") || ""),
      "write",
    );
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv"))
      throw new DocumentTransferError("Choose a CSV file.");
    if (
      ![
        "",
        "text/csv",
        "application/csv",
        "text/plain",
        "application/vnd.ms-excel",
        "application/octet-stream",
      ].includes(file.type.toLowerCase())
    )
      throw new DocumentTransferError("Choose a CSV file saved as UTF-8.");
    if (!file.size || file.size > DOCUMENT_CSV_MAX_BYTES)
      throw new DocumentTransferError("Choose a nonempty CSV file up to 2 MB.");
    let csv: string;
    try {
      csv = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
    } catch {
      throw new DocumentTransferError(
        "Save the CSV with UTF-8 encoding and try again.",
      );
    }
    let source;
    try {
      source = parseDocumentCsv(csv);
    } catch (error) {
      throw new DocumentTransferError(
        error instanceof Error ? error.message : "Check the CSV formatting.",
      );
    }
    const rows = await prepareDocumentImport(context, officeId, type, source);
    if (!rows.length)
      throw new DocumentTransferError(
        "Add at least one document below the CSV header.",
      );
    // One insert statement: validation/constraint/RLS failure rolls the entire batch back.
    const { error } = await context.client
      .from(definitions[documentCollection(type)].table)
      .insert(rows);
    if (error) {
      if (error.code === "42501")
        throw new DocumentTransferError(
          "Your editing access changed. Nothing was imported; reload and try again.",
          403,
        );
      if (["23503", "23514", "40001", "40P01", "23505"].includes(error.code))
        throw new DocumentTransferError(
          "The records, terms or ordering changed while importing. Nothing was imported; reload, check the reference IDs and try again.",
          409,
        );
      throw new DocumentTransferError(
        "Could not confirm the import. Reload the document list before retrying to avoid duplicates.",
        503,
      );
    }
    revalidatePath("/", "layout");
    return {
      ok: true,
      count: rows.length,
      message: `Imported ${rows.length} document${rows.length === 1 ? "" : "s"}. Add PDF attachments by editing the imported records.`,
    };
  } catch (error) {
    if (error instanceof DocumentTransferError)
      return {
        ok: false,
        message: error.message,
        ...(error.errors ? { errors: error.errors } : {}),
      };
    return {
      ok: false,
      message:
        "Unable to confirm the import. Reload the document list before retrying to avoid duplicates.",
    };
  }
}
