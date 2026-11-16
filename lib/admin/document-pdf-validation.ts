export const PDF_LIMIT = 10 * 1024 * 1024;

/** Check size, declared format and PDF framing before publishing the uploaded bytes. */
export async function validateDocumentPdf(file: Blob) {
  if (!file.size || file.size > PDF_LIMIT)
    throw new Error("Choose a PDF up to 10 MB.");
  if (file.type !== "application/pdf") throw new Error("Choose a PDF file.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (
    !/^%PDF-(1\.[0-7]|2\.0)[\r\n]/.test(
      bytes.subarray(0, 16).toString("ascii"),
    ) ||
    !/%%EOF\s*$/.test(bytes.subarray(-1024).toString("ascii"))
  )
    throw new Error(
      "This file is not a readable PDF. Export it as a PDF and try again.",
    );
  return bytes;
}

export function documentPdfPrefix(
  office: string,
  user: string,
  collection: string,
) {
  return `legislative/${office}/${user}/${collection}/`;
}

export function validDocumentPdfPath(path: string, prefix: string) {
  return (
    path.startsWith(prefix) &&
    /^[0-9a-f-]{36}\.pdf$/.test(path.slice(prefix.length))
  );
}
