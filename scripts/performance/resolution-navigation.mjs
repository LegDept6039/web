// Local production benchmark, real public Supabase reads. Never writes database data.
// Run after starting Next with public-fetch-profile.mjs via --import.
// node scripts/performance/resolution-navigation.mjs baseline http://127.0.0.1:3040 5
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [phase = "baseline", origin = "http://127.0.0.1:3040", trialsRaw = "5"] =
  process.argv.slice(2);
const trials = Number(trialsRaw);
const output = path.resolve("outputs/resolution-navigation-20261127");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const runs = [];

function cleanUrl(raw) {
  const url = new URL(raw);
  return url.origin === origin
    ? `${url.pathname}${url.search}`
    : `[external]${url.pathname}`;
}

async function measure(page, cdp, name, target, ready) {
  const network = new Map();
  const startedAt = Date.now();
  const onRequest = (event) =>
    network.set(event.requestId, {
      url: cleanUrl(event.request.url),
      type: event.type,
      startedAt: event.timestamp,
      wallStartedAt: event.wallTime * 1000,
      requestId: event.requestId,
      method: event.request.method,
    });
  const onResponse = (event) => {
    const entry = network.get(event.requestId);
    if (entry)
      Object.assign(entry, {
        status: event.response.status,
        mimeType: event.response.mimeType,
        ttfbMs: (event.timestamp - entry.startedAt) * 1000,
        fromDiskCache: Boolean(event.response.fromDiskCache),
        fromServiceWorker: Boolean(event.response.fromServiceWorker),
      });
  };
  const onFinish = (event) => {
    const entry = network.get(event.requestId);
    if (entry)
      Object.assign(entry, {
        durationMs: (event.timestamp - entry.startedAt) * 1000,
        transferredBytes: event.encodedDataLength,
      });
  };
  cdp.on("Network.requestWillBeSent", onRequest);
  cdp.on("Network.responseReceived", onResponse);
  cdp.on("Network.loadingFinished", onFinish);
  const before = Object.fromEntries(
    (await cdp.send("Performance.getMetrics")).metrics.map((m) => [
      m.name,
      m.value,
    ]),
  );
  const documentId = await page.evaluate(() => performance.timeOrigin);
  // Capture time at the actual anchor click and use a MutationObserver + next paint
  // to identify when the destination's readable content first appears.
  await page.evaluate(
    ({ name, ready }) => {
      window.__resolutionBenchmark = { name, ready, clicked: null, done: null };
      const state = window.__resolutionBenchmark;
      const visible = () => {
        const elements = [...document.querySelectorAll(state.ready.selector)];
        return elements.find((element) => {
          const rect = element.getBoundingClientRect();
          const text = element.textContent || "";
          const body = document.querySelector(".record-body-copy");
          const bodyReady =
            state.name !== "detail" ||
            (body &&
              body.getBoundingClientRect().height > 0 &&
              body.textContent.trim());
          return (
            rect.width &&
            rect.height &&
            bodyReady &&
            (!state.ready.text || text.includes(state.ready.text))
          );
        });
      };
      const observer = new MutationObserver(() => {
        if (state.clicked !== null && visible() && state.done === null) {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (visible() && state.done === null)
                state.done = performance.now();
            }),
          );
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      window.addEventListener(
        "click",
        (event) => {
          const anchor =
            event.target instanceof Element && event.target.closest("a");
          if (anchor && state.clicked === null)
            state.clicked = performance.now();
        },
        { capture: true, once: true },
      );
    },
    { name, ready },
  );
  const wallStart = performance.now();
  await target.click();
  await page
    .locator(ready.selector)
    .filter(ready.text ? { hasText: ready.text } : {})
    .first()
    .waitFor({ state: "visible", timeout: 45000 });
  // The record title alone is not enough: also wait for the body of this record.
  if (name === "detail")
    await page
      .locator(
        ".record-body .record-body-text, .record-body p, .record-body div",
      )
      .first()
      .waitFor({ state: "visible", timeout: 45000 });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const wallMs = performance.now() - wallStart;
  const state = await page.evaluate(() => window.__resolutionBenchmark);
  const after = Object.fromEntries(
    (await cdp.send("Performance.getMetrics")).metrics.map((m) => [
      m.name,
      m.value,
    ]),
  );
  const endDocumentId = await page.evaluate(() => performance.timeOrigin);
  const metrics = {};
  for (const metric of [
    "TaskDuration",
    "ScriptDuration",
    "LayoutDuration",
    "RecalcStyleDuration",
  ])
    metrics[`${metric}Ms`] = (after[metric] - before[metric]) * 1000;
  metrics.nodes = after.Nodes;
  metrics.jsHeapBytes = after.JSHeapUsedSize;
  // Let the stream's final transfer accounting arrive without extending click timing.
  await page.waitForTimeout(100);
  cdp.off("Network.requestWillBeSent", onRequest);
  cdp.off("Network.responseReceived", onResponse);
  cdp.off("Network.loadingFinished", onFinish);
  const requests = [...network.values()];
  const pathname = new URL(page.url()).pathname;
  const navigationRequests = requests.filter(
    (request) =>
      new URL(request.url, origin).pathname === pathname &&
      (request.mimeType === "text/x-component" || request.type === "Document"),
  );
  for (const request of navigationRequests) {
    try {
      const responseBody = await cdp.send("Network.getResponseBody", {
        requestId: request.requestId,
      });
      request.decodedBodyBytes = Buffer.byteLength(
        responseBody.body,
        responseBody.base64Encoded ? "base64" : "utf8",
      );
    } catch {
      /* A prefetched or streamed response body may have been evicted. */
    }
  }
  const browserTiming = await page.evaluate(
    ({ pathname, state }) => ({
      click: state.clicked,
      readable: state.done,
      resources: performance
        .getEntriesByType("resource")
        .filter((entry) => new URL(entry.name).pathname === pathname)
        .map((entry) => ({
          startTime: entry.startTime,
          responseStart: entry.responseStart,
          responseEnd: entry.responseEnd,
          duration: entry.duration,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
          responseEndToReadableMs:
            state.done === null ? null : state.done - entry.responseEnd,
        })),
      longTasks: (window.__resolutionLongTasks || []).filter(
        (entry) =>
          entry.startTime >= state.clicked && entry.startTime <= state.done,
      ),
    }),
    { pathname, state },
  );
  return {
    name,
    startedAt,
    finishedAt: Date.now(),
    url: cleanUrl(page.url()),
    clickToReadableMs:
      state?.done !== null && state?.clicked !== null
        ? state.done - state.clicked
        : null,
    playwrightClickToVisibleMs: wallMs,
    fullReload: documentId !== endDocumentId,
    tableRows:
      name === "archive"
        ? await page.locator(".legislative-table tbody tr").count()
        : null,
    resultCount:
      name === "archive"
        ? await page.locator(".results-count").textContent()
        : null,
    title: name === "detail" ? await page.locator("h1").textContent() : null,
    metrics,
    requests,
    totalTransferredBytes: requests.reduce(
      (sum, request) => sum + (request.transferredBytes || 0),
      0,
    ),
    navigationTransferredBytes: requests
      .filter(
        (request) =>
          request.mimeType === "text/x-component" ||
          request.type === "Document",
      )
      .reduce((sum, request) => sum + (request.transferredBytes || 0), 0),
    destinationTransferredBytes: navigationRequests.reduce(
      (sum, request) => sum + (request.transferredBytes || 0),
      0,
    ),
    destinationRequests: navigationRequests,
    browserTiming,
  };
}

try {
  for (let trial = 1; trial <= trials; trial++) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    if (process.env.BENCH_ICON_CONTROL === "1") {
      const icon = await sharp("app/icon.png")
        .resize(64, 64, { fit: "inside" })
        .png()
        .toBuffer();
      await context.route("**/icon.png*", (route) =>
        route.fulfill({ status: 200, contentType: "image/png", body: icon }),
      );
    }
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__resolutionLongTasks = [];
      new PerformanceObserver((list) =>
        window.__resolutionLongTasks.push(
          ...list
            .getEntries()
            .map((entry) => ({
              startTime: entry.startTime,
              duration: entry.duration,
            })),
        ),
      ).observe({ type: "longtask", buffered: true });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Performance.enable");
    await page.goto(origin, { waitUntil: "networkidle", timeout: 60000 });
    await page.locator("header button", { hasText: "Legislative" }).waitFor();
    for (const visit of ["first", "repeat"]) {
      if (visit === "repeat") {
        await page.locator("header nav a", { hasText: /^Home$/ }).click();
        await page.waitForURL(origin + "/");
        await page.waitForTimeout(300);
      }
      await page.locator("header button", { hasText: "Legislative" }).click();
      const archive = await measure(
        page,
        cdp,
        "archive",
        page.locator("#menu-Legislative a", { hasText: /^Resolutions$/ }),
        { selector: ".legislative-table tbody tr" },
      );
      const row = page
        .locator(".legislative-table tbody tr")
        .filter({
          has: page.locator('td[data-label="No."]', { hasText: /^232-2026$/ }),
        });
      if ((await row.count()) === 0)
        throw new Error(
          "Resolution232-2026 is not on the archive page; benchmark pagination selection must be specified.",
        );
      await row.scrollIntoViewIfNeeded();
      const detail = await measure(
        page,
        cdp,
        "detail",
        row.getByRole("link", { name: "View record" }),
        { selector: "h1", text: "Resolution No. 232-2026" },
      );
      runs.push({ trial, visit, archive, detail });
      console.log(
        JSON.stringify({
          trial,
          visit,
          archiveMs: archive.clickToReadableMs,
          detailMs: detail.clickToReadableMs,
          rows: archive.tableRows,
        }),
      );
      await writeFile(
        path.join(output, `${phase}.json`),
        JSON.stringify(
          {
            phase,
            methodology: {
              environment:
                "Local Next.js production next start, real hosted public Supabase reads",
              origin,
              browser: browser.version(),
              viewport: "1440x1000",
              cpuThrottling: false,
              networkThrottling: false,
              trials,
              visits: `${trials} fresh browser contexts. Each first archive/detail visit paired with repeat via homepage in same context. Server process is warm; browser first visit is not a Vercel cold start.`,
              iconControl:
                process.env.BENCH_ICON_CONTROL === "1"
                  ? "Diagnostic only: app icon intercepted with64pxderivative; routing disables browserHTTPcache. Excluded from before/after medians."
                  : false,
              timer:
                "Actual archive/detail anchor click to matching DOM and two animation frames. Detail additionally verifies visible body. Table ready means populated table rows, not a skeleton.",
              navigation:
                "Homepage loaded before timing; Legislative menu opened immediately before archive anchor click. Natural Next Link prefetch stays enabled.",
              privacy:
                "Only timing, byte/row counts, field names, public URLs and record number retained; no response text, cookies or credentials.",
              buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
            },
            runs,
          },
          null,
          2,
        ),
      );
    }
    await context.close();
  }
} finally {
  await browser.close();
}
