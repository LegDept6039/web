import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const directory = path.resolve("outputs/resolution-navigation-20261127");
const read = async (name) =>
  JSON.parse(await readFile(path.join(directory, name), "utf8"));
const baseline = await read("baseline.json");
const after = await read("after.json");
const diagnostic = await read("baseline-profile.json");
const paginationOnly = await read("pagination-only.json");
const control = await read("icon-control.json");
const stats = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return {
    median: sorted[Math.floor(sorted.length / 2)],
    minimum: sorted[0],
    maximum: sorted.at(-1),
  };
};
const ms = (value) => Math.round(value);
const format = (values) => {
  const result = stats(values);
  return `${ms(result.median)} (${ms(result.minimum)}–${ms(result.maximum)})`;
};
const timingRows = [];
for (const action of ["archive", "detail"])
  for (const visit of ["first", "repeat"]) {
    timingRows.push(
      `| ${action === "archive" ? "Homepage → Legislative → Resolutions" : "View record: Resolution 232-2026"} | ${visit} | ${format(baseline.runs.filter((r) => r.visit === visit).map((r) => r[action].clickToReadableMs))} | ${format(after.runs.filter((r) => r.visit === visit).map((r) => r[action].clickToReadableMs))} |`,
    );
  }
const browserRows = [];
for (const action of ["archive", "detail"])
  for (const phase of [baseline, after]) {
    const first = phase.runs.filter((r) => r.visit === "first");
    browserRows.push(
      `| ${phase.phase} | ${action} | ${ms(stats(first.map((r) => r[action].metrics.ScriptDurationMs)).median)} | ${ms(stats(first.map((r) => r[action].metrics.LayoutDurationMs)).median)} | ${ms(stats(first.map((r) => r[action].metrics.RecalcStyleDurationMs)).median)} |`,
    );
  }
const rows = [baseline, after].map((phase) => ({
  phase: phase.phase,
  first: Object.fromEntries(
    ["archive", "detail"].map((action) => [
      action,
      stats(
        phase.runs
          .filter((r) => r.visit === "first")
          .map((r) => r[action].clickToReadableMs),
      ),
    ]),
  ),
  repeat: Object.fromEntries(
    ["archive", "detail"].map((action) => [
      action,
      stats(
        phase.runs
          .filter((r) => r.visit === "repeat")
          .map((r) => r[action].clickToReadableMs),
      ),
    ]),
  ),
}));

const payloadRows = [];
for (const phase of [diagnostic, after])
  for (const action of ["archive", "detail"]) {
    const requests = phase.runs
      .filter((r) => r.visit === "first")
      .map(
        (r) =>
          r[action].destinationRequests
            .filter((q) => q.decodedBodyBytes)
            .sort((a, b) => b.decodedBodyBytes - a.decodedBodyBytes)[0],
      )
      .filter(Boolean);
    payloadRows.push(
      `| ${phase === diagnostic ? "baseline diagnostic" : "after"} | ${action} | ${ms(stats(requests.map((r) => r.transferredBytes)).median)} | ${ms(stats(requests.map((r) => r.decodedBodyBytes)).median)} |`,
    );
  }
const allActions = [...baseline.runs, ...after.runs].flatMap((run) => [
  run.archive,
  run.detail,
]);
const reloads = allActions.filter((action) => action.fullReload).length;
const readyLag = (run, action) =>
  run[action].browserTiming.resources
    .filter((entry) => entry.startTime >= run[action].browserTiming.click)
    .sort((a, b) => b.decodedBodySize - a.decodedBodySize)[0]
    ?.responseEndToReadableMs;
const afterLongestTask = Math.max(
  0,
  ...after.runs.flatMap((run) =>
    run.archive.browserTiming.longTasks.map((entry) => entry.duration),
  ),
);
const text = `# Local public-resolution navigation measurements — 2026-11-27

Local Next.js production \`next start\` on port 3040, reading the real hosted public Supabase dataset. These are **local measurements**, not Vercel production timings or cold-start measurements. Chrome ${after.methodology.browser}, 1440 × 1000, headless, CPU and network unthrottled. The server process is warm. Network latency to hosted Supabase varies.

Each phase contains five fresh browser contexts. In each context: load the homepage, open the Legislative menu, click Resolutions, wait for actual table rows; scroll to Resolution 232-2026, click View record, wait for both the correct record title and visible body; return via the homepage and repeat both actions in the same context. Normal Next Link prefetch and browser/router caches stay enabled. The timing starts at the actual destination link click and ends after the matching content appears plus two animation frames. Homepage loading, opening the menu, and scrolling to the record are outside the timed interval.

## Navigation timings

Milliseconds, median (minimum–maximum), five observations per row.

| Action | Browser visit | Before | After |
| --- | --- | ---: | ---: |
${timingRows.join("\n")}

The baseline archive rendered 142 rows. After the change it renders ${after.runs[0].archive.tableRows} rows and retains the accurate result count, ${JSON.stringify(after.runs[0].archive.resultCount.trim())}. Both actions used client-side navigation: **${reloads} full reloads across ${allActions.length} measured transitions**. A full page reload was not the verified cause.

## Verified data and browser work

- **The dominant verified archive stall was the favicon, not table rendering.** The generated \`/icon.png\` response was the original 12,661,586-byte, 6,689 × 6,706 PNG (about 45 megapixels). Chrome's timeline attributed 1,026–1,281 ms to PNG image decoding inside a 1,590–1,832 ms main-thread loader task during archive navigation. The image resource URL and size matched \`app/icon.png\`. The app icon is now a 64 px, 8,445-byte derivative. Header/footer seal images used smaller Next Image variants; the original source seal is preserved.
- Pagination alone reduced the payload but left archive medians at ${ms(stats(paginationOnly.runs.filter((r) => r.visit === "first").map((r) => r.archive.clickToReadableMs)).median)} ms first / ${ms(stats(paginationOnly.runs.filter((r) => r.visit === "repeat").map((r) => r.archive.clickToReadableMs)).median)} ms repeat. A controlled run on that exact build intercepted only the icon with a 64 px derivative: first archive visits took ${control.runs
  .filter((r) => r.visit === "first")
  .map((r) => ms(r.archive.clickToReadableMs))
  .join(" / ")} ms; repeats took ${control.runs
  .filter((r) => r.visit === "repeat")
  .map((r) => ms(r.archive.clickToReadableMs))
  .join(
    " / ",
  )} ms. This intervention isolated the oversized icon's effect. Playwright routing disables browser HTTP caching in this diagnostic, so those values are excluded from the main medians. Final after trials use the actual resized app icon, with no request interception.
- Before: the published resolutions query returned all 142 records, **186,866 bytes** of database JSON, including **37,084 bytes of summary text**, PDF URL fields, and committee/session details unused in the archive. This dataset has no PDF URLs; no PDF file was downloaded by the archive.
- Before: author/co-author names were embedded in the same PostgREST request; there was no author query per row. The detail route also fetched the entire 142-record collection and selected one record in memory.
- In the five baseline first-visit archive windows, metadata instrumentation recorded four full-collection resolution queries (the archive plus visible-link prefetch); repeat archive windows had one. These background requests are distinct from the primary navigation response. Query logs contain only field names, sizes, counts and elapsed times, never credentials or response bodies.
- After: the archive performs server-side term/year/search filtering before its 25-row range, uses an exact filtered count, and requests only displayed list fields (**16,973 bytes for the 25 rows**). The year options use a separate year-only projection (2,412 bytes for 142 rows), not full documents. The detail route requests one published record by ID (**1,579 bytes for Resolution 232-2026**). Filter and pagination state is in the URL and the detail's back link. Pagination bounds the work as this archive grows; it was not the primary fix for the measured favicon stall.
- No shared data cache was introduced. Every archive and detail read remains fresh and honors the existing public publication policies; publishing/correcting/unpublishing does not require cache invalidation. Drafts, previews, and staff responses are not put in a shared cache by this change.

Primary destination RSC response only (the largest completed destination response), excluding other routes' prefetch traffic. CDP transferred bytes include response overhead; decoded bytes are the decoded response body. The baseline payload diagnostic is a separate first/repeat pair run on the same baseline build after the five timing trials.

| Phase | Action | Transferred bytes | Decoded body bytes |
| --- | --- | ---: | ---: |
${payloadRows.join("\n")}

The baseline diagnostic archive completed its main RSC transfer about **1,578 ms before the rows' ready paint on the first visit**, and **1,342 ms before it on the repeat visit**. It observed a 1,708 ms first-visit main-thread long task (1,472 ms repeat). The later trace identified the oversized PNG decode; this lag must not be described as pure table rendering. Parsing, React work, DOM/layout, image decode, scheduler activity and the readiness/paint boundary overlap. Detail response-end-to-readable delay in that diagnostic was 78 ms first / 28 ms repeat, with no long task during that ready interval.

After the actual icon fix, archive response-end-to-readable medians are **${ms(stats(after.runs.filter((run) => run.visit === "first").map((run) => readyLag(run, "archive"))).median)} ms first / ${ms(stats(after.runs.filter((run) => run.visit === "repeat").map((run) => readyLag(run, "archive"))).median)} ms repeat**. The longest observed archive main-thread long task across all ten final archive transitions is ${ms(afterLongestTask)} ms, rather than the previous 1.5–1.7 second task.

The following CDP timings are medians for the entire first-visit navigation window, **not isolated table CPU measurements**. They help compare the same browser operations before/after; do not add them to server timings, because work can overlap.

| Phase | Action | Script ms | Layout ms | Style recalculation ms |
| --- | --- | ---: | ---: | ---: |
${browserRows.join("\n")}

## Reproduction and artifacts

Start a completed production build with the public-read profiler (PowerShell):

\`\`\`powershell
$env:PUBLIC_FETCH_PROFILE_LOG = "$PWD/outputs/resolution-navigation-20261127/after-server-fetches.ndjson"
node --env-file=.env.local --import ./scripts/performance/public-fetch-profile.mjs node_modules/next/dist/bin/next start --port 3040
\`\`\`

In a separate terminal:

\`\`\`powershell
node scripts/performance/resolution-navigation.mjs after http://127.0.0.1:3040 5
node scripts/performance/summarize-resolution-navigation.mjs
\`\`\`

Raw runs: \`baseline.json\`, \`after.json\`; detailed baseline diagnostic: \`baseline-profile.json\`; metadata-only database fetch logs: \`baseline-server-fetches.ndjson\` and \`after-server-fetches.ndjson\`. Build IDs and browser/version conditions are stored in the JSON. \`pagination-only.json\`, \`pagination-only-trace-summary.json\`, and \`icon-control.json\` document the causal investigation. \`baseline-exploratory.json\` is excluded from reported medians because its original timer checked the title before separately verifying the body.
`;
await writeFile(
  path.join(directory, "summary.json"),
  JSON.stringify(rows, null, 2),
);
await writeFile(path.join(directory, "report.md"), text);
console.log(text);
