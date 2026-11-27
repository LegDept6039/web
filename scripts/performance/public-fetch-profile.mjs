// Opt-in local production profiling. Records metadata only, never keys or content.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const log = process.env.PUBLIC_FETCH_PROFILE_LOG;
if (log) {
  mkdirSync(dirname(log), { recursive: true });
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async function profiledFetch(input, init) {
    const raw =
      typeof input === "string" || input instanceof URL ? input : input.url;
    const url = new URL(raw);
    if (!url.pathname.startsWith("/rest/v1/"))
      return fetchOriginal(input, init);
    const start = performance.now();
    const startedAt = Date.now();
    const response = await fetchOriginal(input, init);
    const headersMs = performance.now() - start;
    const clone = response.clone();
    void clone
      .text()
      .then((body) => {
        let rows = [];
        try {
          const parsed = JSON.parse(body);
          rows = Array.isArray(parsed) ? parsed : [];
        } catch {
          /* Only size is recorded for non-JSON error responses. */
        }
        appendFileSync(
          log,
          JSON.stringify({
            startedAt,
            finishedAt: Date.now(),
            table: url.pathname.slice("/rest/v1/".length),
            select: url.searchParams.get("select"),
            limit: url.searchParams.get("limit"),
            offset: url.searchParams.get("offset"),
            filterColumns: [...url.searchParams.keys()].filter(
              (k) => !["select", "order", "limit", "offset"].includes(k),
            ),
            status: response.status,
            headersMs,
            bodyMs: performance.now() - start,
            bodyBytes: Buffer.byteLength(body),
            rows: rows.length,
            returnedFields: [
              ...new Set(rows.flatMap((row) => Object.keys(row))),
            ],
            summaryBytes: rows.reduce(
              (n, row) => n + Buffer.byteLength(String(row.summary ?? "")),
              0,
            ),
            nonEmptyPdfUrls: rows.filter((row) => Boolean(row.pdf_url)).length,
          }) + "\n",
        );
      })
      .catch(() => {});
    return response;
  };
}
