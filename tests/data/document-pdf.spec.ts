import { test, expect } from "@playwright/test";
import {
  PDF_LIMIT,
  validateDocumentPdf,
  documentPdfPrefix,
  validDocumentPdfPath,
} from "../../lib/admin/document-pdf-validation";

test("PDF validation checks size, MIME and actual file framing", async () => {
  const pdf = "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n";
  expect(
    (
      await validateDocumentPdf(new Blob([pdf], { type: "application/pdf" }))
    ).toString(),
  ).toBe(pdf);
  for (const file of [
    new Blob([pdf], { type: "text/plain" }),
    new Blob(["<html>not a PDF</html>"], { type: "application/pdf" }),
    new Blob(["%PDF-1.7\ntruncated"], { type: "application/pdf" }),
    new Blob([], { type: "application/pdf" }),
    new Blob([new Uint8Array(PDF_LIMIT + 1)], { type: "application/pdf" }),
  ])
    await expect(validateDocumentPdf(file)).rejects.toThrow();
  const exactLimit = new Blob(
    ["%PDF-1.7\n", new Uint8Array(PDF_LIMIT - 15), "%%EOF\n"],
    { type: "application/pdf" },
  );
  expect((await validateDocumentPdf(exactLimit)).length).toBe(PDF_LIMIT);
});

test("PDF staging references are bound to the authenticated user, office and collection", () => {
  const prefix = documentPdfPrefix("office", "user", "ordinances");
  const filename = "00000000-0000-4000-8000-000000000001.pdf";
  expect(validDocumentPdfPath(prefix + filename, prefix)).toBe(true);
  for (const path of [
    documentPdfPrefix("other", "user", "ordinances") + filename,
    documentPdfPrefix("office", "other", "ordinances") + filename,
    documentPdfPrefix("office", "user", "documents") + filename,
    prefix + "../" + filename,
    prefix + filename + "?override=true",
  ])
    expect(validDocumentPdfPath(path, prefix)).toBe(false);
});
