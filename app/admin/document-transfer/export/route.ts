import { officeContext } from "@/lib/offices/server";
import {
  serializeDocumentCsv,
  serializeCsvTable,
} from "@/lib/legislative/document-csv";
import {
  authorizeDocumentTransfer,
  readDocumentExport,
  readDocumentReferences,
  DOCUMENT_EXPORT_MAX_BYTES,
  DocumentTransferError,
} from "@/lib/legislative/document-transfer";
import { philippineDate } from "@/lib/legislative/terms";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(request: Request) {
  const context = await officeContext(true);
  try {
    const params = new URL(request.url).searchParams;
    const office = params.get("office") || "";
    const type = authorizeDocumentTransfer(
      context,
      office,
      params.get("type") || "",
      "read",
    );
    const template = params.get("template") === "1";
    const references = params.get("references") === "1";
    if (template && references)
      throw new DocumentTransferError("Choose a template or reference list.");
    const body = references
      ? serializeCsvTable(
          ["record_type", "id", "name", "term_id", "term_name"],
          await readDocumentReferences(context, office),
        )
      : serializeDocumentCsv(
          template ? [] : await readDocumentExport(context, office, type),
        );
    if (new TextEncoder().encode(body).byteLength > DOCUMENT_EXPORT_MAX_BYTES)
      throw new DocumentTransferError(
        "This export exceeds 10 MB. No partial file was downloaded.",
        413,
      );
    const suffix = template
      ? "template"
      : references
        ? "reference-ids"
        : philippineDate();
    return new Response(body, {
      headers: {
        ...privateHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="legislative-${type}-${suffix}.csv"`,
      },
    });
  } catch (error) {
    const known = error instanceof DocumentTransferError;
    return Response.json(
      {
        error: known
          ? error.message
          : "Unable to export documents. Please try again.",
      },
      {
        status: known ? error.status : 503,
        headers: privateHeaders,
      },
    );
  }
}
