export const DOCUMENT_CSV_MAX_BYTES = 2 * 1024 * 1024;
export const DOCUMENT_CSV_MAX_ROWS = 100;
export const DOCUMENT_CSV_HEADERS = [
  "id",
  "title",
  "number",
  "date",
  "description",
  "author_id",
  "co_author_id",
  "committee_id",
  "session_id",
  "attachment_url",
  "approval_mode",
] as const;

export type DocumentCsvHeader = (typeof DOCUMENT_CSV_HEADERS)[number];
export type DocumentCsvRow = Record<DocumentCsvHeader, string>;

const unsupportedControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const spreadsheetFormula = /^(?:\s*[=+\-@]|[\t\r\n])/;

/**
 * Spreadsheet escape convention: prefix one apostrophe if a value could be a
 * formula, starts with a spreadsheet control character, or already starts with
 * an apostrophe. Import removes that one escape only in those cases. Doubling
 * literal leading apostrophes keeps exports reversible without executing cells.
 */
function escapeSpreadsheet(value: string) {
  return value.startsWith("'") || spreadsheetFormula.test(value)
    ? "'" + value
    : value;
}

function unescapeSpreadsheet(value: string) {
  if (!value.startsWith("'")) return value;
  const rest = value.slice(1);
  return rest.startsWith("'") || spreadsheetFormula.test(rest) ? rest : value;
}

/**
 * Parse UTF-8 CSV text. Decode uploaded bytes with a fatal UTF-8 TextDecoder
 * before calling this function. This checks file structure only; the caller
 * must still validate document fields, ownership, relationships and permissions.
 * IDs and attachment URLs are references, never permission or upload authority.
 */
export function parseDocumentCsv(input: string): DocumentCsvRow[] {
  if (new TextEncoder().encode(input).byteLength > DOCUMENT_CSV_MAX_BYTES)
    throw new Error("Choose a CSV file up to 2 MB.");
  if (unsupportedControls.test(input))
    throw new Error("The CSV contains unsupported control characters.");

  const text = input.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let fields: string[] = [];
  let value = "";
  let quoted = false;
  let quoteClosed = false;
  let recordStarted = false;
  let line = 1;

  const finishRecord = () => {
    // Ignore empty physical lines, but preserve explicitly empty CSV records.
    if (recordStarted || fields.length || value) {
      records.push([...fields, value]);
      if (records.length > DOCUMENT_CSV_MAX_ROWS + 1)
        throw new Error("Import no more than 100 documents at a time.");
    }
    fields = [];
    value = "";
    quoteClosed = false;
    recordStarted = false;
  };

  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (quoted) {
      if (character === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          quoteClosed = true;
        }
      } else {
        value += character;
        if (character === "\n" || (character === "\r" && text[i + 1] !== "\n"))
          line++;
      }
      continue;
    }
    if (quoteClosed && ![",", "\r", "\n"].includes(character))
      throw new Error(`Unexpected text after a closing quote on line ${line}.`);
    if (character === '"') {
      if (value)
        throw new Error(
          `Unexpected quote in an unquoted field on line ${line}.`,
        );
      quoted = true;
      recordStarted = true;
    } else if (character === ",") {
      fields.push(value);
      value = "";
      quoteClosed = false;
      recordStarted = true;
    } else if (character === "\r" || character === "\n") {
      finishRecord();
      if (character === "\r" && text[i + 1] === "\n") i++;
      line++;
    } else {
      value += character;
      recordStarted = true;
    }
  }
  if (quoted) throw new Error("The CSV ends inside a quoted field.");
  finishRecord();

  if (!records.length) throw new Error("The CSV needs a header row.");
  const headers = records[0].map((header) => header.trim());
  if (new Set(headers).size !== headers.length)
    throw new Error("The CSV contains duplicate column headers.");
  for (const header of headers)
    if (!(DOCUMENT_CSV_HEADERS as readonly string[]).includes(header))
      throw new Error(`Unknown CSV column: ${header || "(blank)"}.`);
  for (const required of ["title", "date", "description"])
    if (!headers.includes(required))
      throw new Error(`The CSV is missing the ${required} column.`);

  return records.slice(1).map((record, index) => {
    if (record.length !== headers.length)
      throw new Error(
        `CSV record ${index + 1} has ${record.length} fields; expected ${headers.length}.`,
      );
    const row = Object.fromEntries(
      DOCUMENT_CSV_HEADERS.map((header) => [header, ""]),
    ) as DocumentCsvRow;
    headers.forEach((header, column) => {
      row[header as DocumentCsvHeader] = unescapeSpreadsheet(record[column]);
    });
    return row;
  });
}

/** Full shared headers, Excel-friendly UTF-8 BOM, CRLF and quoted safe cells. */
export function serializeDocumentCsv(
  rows: readonly Partial<DocumentCsvRow>[],
): string {
  return serializeCsvTable(
    DOCUMENT_CSV_HEADERS,
    rows.map((row) =>
      DOCUMENT_CSV_HEADERS.map((header) => String(row[header] ?? "")),
    ),
  );
}

/** The same safe encoding for related-record reference downloads. */
export function serializeCsvTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const cell = (value: string, forceQuote: boolean) => {
    if (unsupportedControls.test(value))
      throw new Error("A document contains unsupported control characters.");
    const safe = escapeSpreadsheet(value);
    return forceQuote || /[",\r\n]/.test(safe)
      ? '"' + safe.replaceAll('"', '""') + '"'
      : safe;
  };
  const lines = [headers.map((header) => cell(header, false)).join(",")];
  for (const row of rows) {
    if (row.length !== headers.length)
      throw new Error("An export record does not match its columns.");
    lines.push(row.map((value) => cell(value, true)).join(","));
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
