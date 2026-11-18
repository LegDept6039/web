import { test, expect } from "@playwright/test";
import {
  DOCUMENT_CSV_HEADERS,
  DOCUMENT_CSV_MAX_BYTES,
  DOCUMENT_CSV_MAX_ROWS,
  parseDocumentCsv,
  serializeCsvTable,
  serializeDocumentCsv,
} from "../../lib/legislative/document-csv";

test("CSV preserves Unicode, quoted commas, quotes, multiline text and references", () => {
  const record = {
    id: "legacy-document-id",
    title: 'An ordinance for "Mabuhay", Pinamungajan',
    number: "2026-001",
    date: "2026-11-18",
    description: "First paragraph.\r\nSecond paragraph: piñata.\nThird line.",
    author_id: "legacy-author",
    co_author_id: "",
    committee_id: "legacy-committee",
    session_id: "legacy-session",
    attachment_url: "https://example.test/reference.pdf",
  };
  const csv = serializeDocumentCsv([record]);
  expect(
    csv.startsWith("\uFEFF" + DOCUMENT_CSV_HEADERS.join(",") + "\r\n"),
  ).toBe(true);
  expect(parseDocumentCsv(csv)).toEqual([record]);
  expect(parseDocumentCsv(serializeDocumentCsv([]))).toEqual([]);
});

test("CSV accepts reordered optional columns and common newline formats", () => {
  for (const newline of ["\r\n", "\n", "\r"]) {
    const rows = parseDocumentCsv(
      `\uFEFFdescription,title,date${newline}${newline}"First, second","Quoted ""title""",2026-11-18${newline}`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: 'Quoted "title"',
      date: "2026-11-18",
      description: "First, second",
      id: "",
      attachment_url: "",
    });
  }
});

test("CSV refuses ambiguous headers and malformed records instead of dropping values", () => {
  for (const csv of [
    "",
    "title,date\nA,2026-11-18",
    "title,date,description,title\nA,2026-11-18,Body,A",
    "title,date,description,role\nA,2026-11-18,Body,superadmin",
    "title,date,description,\nA,2026-11-18,Body,",
    "title,date,description\nA,2026-11-18,Body,Unexpected",
    "title,date,description\nA,2026-11-18",
    'title,date,description\n"Unclosed,2026-11-18,Body',
    'title,date,description\nUn"quoted,2026-11-18,Body',
    'title,date,description\n"Closed"extra,2026-11-18,Body',
    "title,date,description\nA,2026-11-18,Body\u0000",
    "title,date,description\nA,2026-11-18,Body\u000b",
    'title,date,description\n""',
  ])
    expect(() => parseDocumentCsv(csv), csv).toThrow();
});

test("CSV enforces import record and UTF-8 byte limits including multibyte text", () => {
  const record = { title: "Title", date: "2026-11-18", description: "Body" };
  expect(
    parseDocumentCsv(
      serializeDocumentCsv(Array(DOCUMENT_CSV_MAX_ROWS).fill(record)),
    ),
  ).toHaveLength(DOCUMENT_CSV_MAX_ROWS);
  expect(() =>
    parseDocumentCsv(
      serializeDocumentCsv(Array(DOCUMENT_CSV_MAX_ROWS + 1).fill(record)),
    ),
  ).toThrow("100 documents");

  const header = "title,date,description\nA,2026-11-18,";
  const remaining =
    DOCUMENT_CSV_MAX_BYTES - new TextEncoder().encode(header).byteLength;
  expect(parseDocumentCsv(header + "a".repeat(remaining))).toHaveLength(1);
  expect(() => parseDocumentCsv(header + "a".repeat(remaining + 1))).toThrow(
    "2 MB",
  );
  expect(() =>
    parseDocumentCsv(header + "ñ".repeat(Math.ceil(remaining / 2) + 1)),
  ).toThrow("2 MB");
});

test("exports neutralize spreadsheet formulas while retaining literal apostrophes on import", () => {
  const values = [
    '=HYPERLINK("https://example.test","click")',
    "+SUM(1,2)",
    "-1+2",
    "@SUM(A1:A2)",
    "   =1+1",
    "\t=1+1",
    "\r=1+1",
    "\n=1+1",
    "'A quoted title",
    "'=Already escaped",
    "''Two apostrophes",
  ];
  for (const value of values) {
    const csv = serializeDocumentCsv([
      { title: value, date: "2026-11-18", description: value },
    ]);
    // Each potentially executable value starts with an apostrophe inside its CSV cell.
    expect(csv).toContain("\"'" + value.replaceAll('"', '""') + '"');
    expect(parseDocumentCsv(csv)[0]).toMatchObject({
      title: value,
      description: value,
    });
  }
  const regular = "An ordinary 'quoted' title";
  expect(
    parseDocumentCsv(serializeDocumentCsv([{ title: regular }]))[0].title,
  ).toBe(regular);
});

test("reference downloads escape cells and reject inconsistent columns", () => {
  expect(
    serializeCsvTable(
      ["record_type", "id", "name"],
      [["official", "legacy-id", "=1+1"]],
    ),
  ).toBe('\uFEFFrecord_type,id,name\r\n"official","legacy-id","\'=1+1"\r\n');
  expect(() => serializeCsvTable(["id"], [["one", "two"]])).toThrow("columns");
  expect(() => serializeCsvTable(["id"], [["unsafe\u0000"]])).toThrow(
    "control characters",
  );
});
