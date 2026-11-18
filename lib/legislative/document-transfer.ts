import "server-only";
import { definitions } from "@/lib/content/schema";
import { contentAllowed, type OfficeContext } from "@/lib/offices/server";
import {
  documentCollection,
  isDocumentType,
  type DocumentType,
} from "./config";
import { DOCUMENT_CSV_MAX_ROWS, type DocumentCsvRow } from "./document-csv";
import { parseLegislative } from "./validation";
import { assignRecordTerm } from "./term-assignment";
import { getTerms } from "./terms-server";

export const DOCUMENT_EXPORT_MAX_ROWS = 5000;
export const DOCUMENT_EXPORT_MAX_BYTES = 10 * 1024 * 1024;
export interface DocumentImportResult {
  ok: boolean;
  message: string;
  errors?: string[];
  count?: number;
}
export class DocumentTransferError extends Error {
  constructor(
    message: string,
    public status = 400,
    public errors?: string[],
  ) {
    super(message);
    this.name = "DocumentTransferError";
  }
}

/** Resolve access from the verified account and live department membership. */
export function authorizeDocumentTransfer(
  context: OfficeContext,
  officeId: string,
  requestedType: string,
  operation: "read" | "write",
): DocumentType {
  if (!isDocumentType(requestedType))
    throw new DocumentTransferError("Choose a valid document type.");
  const office = context.offices.find((candidate) => candidate.id === officeId);
  if (
    !office ||
    !office.active ||
    office.archived_at ||
    office.department !== "legislative" ||
    !contentAllowed(
      context,
      documentCollection(requestedType),
      {
        office_id: office.id,
        content_scope: "legislative",
      },
      operation,
    )
  )
    throw new DocumentTransferError(
      "You do not have access to this Legislative office.",
      403,
    );
  return requestedType;
}

function text(value: unknown) {
  return value == null ? "" : String(value);
}
function numbered(type: DocumentType) {
  return type === "ordinance" || type === "resolution";
}
function identity(type: DocumentType, row: Record<string, unknown>) {
  const normalize = (value: unknown) =>
    text(value).trim().replace(/\s+/g, " ").toLowerCase();
  return JSON.stringify(
    numbered(type)
      ? [normalize(row.number), text(row.year)]
      : [normalize(row.title), text(row.date)],
  );
}

/** Read a bounded, explicitly scoped set. Never silently return a partial export. */
export async function readDocumentExport(
  context: OfficeContext,
  officeId: string,
  type: DocumentType,
): Promise<DocumentCsvRow[]> {
  authorizeDocumentTransfer(context, officeId, type, "read");
  const table = definitions[documentCollection(type)].table;
  const columns = numbered(type)
    ? "id,title,number,date_approved,summary,author_id,co_author_id,committee_id,session_id,pdf_url"
    : "id,title,date,description,session_id,file_url";
  const rows: DocumentCsvRow[] = [];
  let bytes = 0;
  for (let offset = 0; ;) {
    let query = context.client
      .from(table)
      .select(columns, { count: "exact" })
      .eq("office_id", officeId)
      .eq("content_scope", "legislative")
      .eq("published", true)
      .order("id")
      .range(offset, offset + 199);
    if (!numbered(type))
      query = query.eq("document_type", type).is("deleted_at", null);
    const { data, error, count } = await query;
    if (error)
      throw new DocumentTransferError(
        "Unable to export documents. Please try again.",
        503,
      );
    if (!data?.length) {
      if (count != null && offset < count)
        throw new DocumentTransferError(
          "The document list changed while exporting. No partial file was downloaded; try again.",
          409,
        );
      break;
    }
    if ((count ?? 0) > DOCUMENT_EXPORT_MAX_ROWS)
      throw new DocumentTransferError(
        "This export exceeds 5,000 documents. No partial file was downloaded.",
        413,
      );
    for (const item of (data || []) as unknown as Record<string, unknown>[]) {
      const row: DocumentCsvRow = {
        id: text(item.id),
        title: text(item.title),
        number: text(item.number),
        date: text(item.date_approved ?? item.date),
        description: text(item.summary ?? item.description),
        author_id: text(item.author_id),
        co_author_id: text(item.co_author_id),
        committee_id: text(item.committee_id),
        session_id: text(item.session_id),
        attachment_url: text(item.pdf_url ?? item.file_url),
      };
      bytes += new TextEncoder().encode(JSON.stringify(row)).byteLength;
      if (
        rows.length >= DOCUMENT_EXPORT_MAX_ROWS ||
        bytes > DOCUMENT_EXPORT_MAX_BYTES
      )
        throw new DocumentTransferError(
          "This export is too large. No partial file was downloaded.",
          413,
        );
      rows.push(row);
    }
    offset += data.length;
    if (offset >= (count ?? Infinity) || (count == null && data.length < 200))
      break;
  }
  return rows;
}

/** IDs for the existing relationship dropdowns, limited to this authorized office. */
export async function readDocumentReferences(
  context: OfficeContext,
  officeId: string,
) {
  authorizeDocumentTransfer(context, officeId, "ordinance", "read");
  const terms = new Map(
    (await getTerms(context.client)).map((term) => [term.id, term.name]),
  );
  const output: string[][] = [];
  let bytes = 0;
  for (const table of ["officials", "committees", "sessions"] as const) {
    for (let offset = 0; ;) {
      let query = context.client
        .from(table)
        .select(
          table === "sessions" ? "id,name,number,term_id" : "id,name,term_id",
          { count: "exact" },
        )
        .eq("office_id", officeId)
        .eq("content_scope", "legislative")
        .order("id")
        .range(offset, offset + 199);
      if (table === "officials")
        query = query.eq("legislative_role", "SANGGUNIANG_BAYAN");
      const { data, error, count } = await query;
      if (error)
        throw new DocumentTransferError(
          "Unable to export reference IDs. Please try again.",
          503,
        );
      if (!data?.length) {
        if (count != null && offset < count)
          throw new DocumentTransferError(
            "The reference list changed while exporting. No partial file was downloaded; try again.",
            409,
          );
        break;
      }
      if ((count ?? 0) + output.length - offset > DOCUMENT_EXPORT_MAX_ROWS)
        throw new DocumentTransferError(
          "The reference list exceeds 5,000 records. No partial file was downloaded.",
          413,
        );
      for (const item of (data || []) as unknown as Record<string, unknown>[]) {
        const reference = [
          table,
          text(item.id),
          text(item.name || item.number || item.id),
          text(item.term_id),
          terms.get(text(item.term_id)) || "Unassigned",
        ];
        bytes += new TextEncoder().encode(JSON.stringify(reference)).byteLength;
        output.push(reference);
        if (
          output.length > DOCUMENT_EXPORT_MAX_ROWS ||
          bytes > DOCUMENT_EXPORT_MAX_BYTES
        )
          throw new DocumentTransferError(
            "The reference list is too large. No partial file was downloaded.",
            413,
          );
      }
      offset += data.length;
      if (offset >= (count ?? Infinity) || (count == null && data.length < 200))
        break;
    }
  }
  return output;
}

/** Preflight the complete file before the single transactional INSERT. */
export async function prepareDocumentImport(
  context: OfficeContext,
  officeId: string,
  type: DocumentType,
  source: readonly DocumentCsvRow[],
) {
  authorizeDocumentTransfer(context, officeId, type, "write");
  if (!source.length || source.length > DOCUMENT_CSV_MAX_ROWS)
    throw new DocumentTransferError(
      "Import between 1 and 100 documents at a time.",
    );
  const collection = documentCollection(type);
  const rows: Record<string, unknown>[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const relatedRecords = new Map<string, Record<string, unknown>>();
  for (const [index, input] of source.entries()) {
    try {
      if (input.id.trim())
        throw new Error(
          "ID is read-only. Existing records cannot be imported again; leave ID blank only for a genuinely new document.",
        );
      if (
        !numbered(type) &&
        [
          input.number,
          input.author_id,
          input.co_author_id,
          input.committee_id,
        ].some((value) => value.trim())
      )
        throw new Error(
          "Number, author, co-author and committee fields apply only to ordinances and resolutions.",
        );
      if (type === "executive-order" && input.session_id.trim())
        throw new Error(
          "Executive Orders use their issuance date and must not specify a session.",
        );
      const form = new FormData();
      for (const key of [
        "title",
        "number",
        "author_id",
        "co_author_id",
        "committee_id",
        "session_id",
      ] as const)
        form.set(key, input[key]);
      form.set(numbered(type) ? "date_approved" : "date", input.date);
      form.set(numbered(type) ? "summary" : "description", input.description);
      form.set("year", input.date.trim().slice(0, 4));
      form.set("document_type", type);
      // Scope, term, publication and ID come from server-side validation, never CSV columns.
      const row = parseLegislative(collection, form, null);
      row.office_id = officeId;
      row.content_scope = "legislative";
      await assignRecordTerm(context.client, collection, row, form);
      for (const column of [
        "author_id",
        "co_author_id",
        "committee_id",
        "session_id",
      ] as const) {
        if (!row[column]) continue;
        const relatedCollection =
          column === "committee_id"
            ? "committees"
            : column === "session_id"
              ? "sessions"
              : "officials";
        const key = `${relatedCollection}:${row[column]}`;
        let related = relatedRecords.get(key);
        if (!related) {
          const result = await context.client
            .from(relatedCollection)
            .select("*")
            .eq("id", row[column])
            .eq("office_id", officeId)
            .eq("content_scope", "legislative")
            .maybeSingle();
          if (result.error || !result.data)
            throw new Error(
              "Choose related records from this Legislative office and term. Download Reference IDs to find valid records.",
            );
          related = result.data;
          relatedRecords.set(key, related!);
        }
        if (
          !related ||
          related.office_id !== officeId ||
          related.content_scope !== "legislative" ||
          related.term_id !== row.term_id ||
          !contentAllowed(context, relatedCollection, related, "read")
        )
          throw new Error(
            "Choose related records from this Legislative office and term. Download Reference IDs to find valid records.",
          );
        if (
          ["author_id", "co_author_id"].includes(column) &&
          related.legislative_role !== "SANGGUNIANG_BAYAN"
        )
          throw new Error(
            "Authors and co-authors must be Sangguniang Bayan members.",
          );
      }
      const key = identity(type, row);
      if (seen.has(key))
        throw new Error("This document is repeated in the CSV.");
      seen.add(key);
      // Place the batch in CSV order, using the existing database ordering trigger.
      row.sort_order = rows.length + 1;
      rows.push(row);
    } catch (error) {
      errors.push(
        `Record ${index + 1}: ${error instanceof Error ? error.message : "Check this record."}`,
      );
    }
  }
  if (errors.length)
    throw new DocumentTransferError(
      "Nothing was imported. Correct the CSV and try again.",
      400,
      errors,
    );
  const table = definitions[collection].table;
  const columns = numbered(type) ? "id,number,year" : "id,title,date";
  const dates = [
    ...new Set(rows.map((row) => (numbered(type) ? row.year : row.date))),
  ];
  let checked = 0;
  for (let offset = 0; ;) {
    let query = context.client
      .from(table)
      .select(columns, { count: "exact" })
      .eq("office_id", officeId)
      .eq("content_scope", "legislative")
      .in(numbered(type) ? "year" : "date", dates)
      .order("id")
      .range(offset, offset + 499);
    if (!numbered(type)) query = query.eq("document_type", type);
    const { data, error, count } = await query;
    if (error)
      throw new DocumentTransferError(
        "Unable to check existing documents. Nothing was imported.",
        503,
      );
    if (!data?.length) {
      if (count != null && offset < count)
        throw new DocumentTransferError(
          "The document list changed during duplicate checks. Nothing was imported; try again.",
          409,
        );
      break;
    }
    if ((count ?? 0) > 20000 || checked + (data?.length || 0) > 20000)
      throw new DocumentTransferError(
        "Too many existing documents to check safely. Import one year or date at a time.",
        413,
      );
    for (const row of (data || []) as unknown as Record<string, unknown>[]) {
      const duplicateIndex = rows.findIndex(
        (candidate) => identity(type, candidate) === identity(type, row),
      );
      if (duplicateIndex >= 0)
        errors.push(
          `Record ${duplicateIndex + 1}: A document with this ${numbered(type) ? "number and year" : "title and date"} already exists. Edit the existing record instead.`,
        );
    }
    checked += data?.length || 0;
    offset += data.length;
    if (checked >= (count ?? Infinity) || (count == null && data.length < 500))
      break;
  }
  if (errors.length)
    throw new DocumentTransferError(
      "Nothing was imported. Duplicate documents were found.",
      409,
      [...new Set(errors)],
    );
  return rows;
}
