import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await page.goto("http://127.0.0.1:3040", { waitUntil: "networkidle" });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
  await page.locator("header button", { hasText: "Legislative" }).click();
  await cdp.send("Tracing.start", {
    categories:
      "devtools.timeline,v8,toplevel,disabled-by-default-devtools.timeline",
    transferMode: "ReturnAsStream",
  });
  await cdp.send("Profiler.start");
  const start = performance.now();
  await page
    .locator("#menu-Legislative a", { hasText: /^Resolutions$/ })
    .click();
  await page
    .locator(".legislative-table tbody tr")
    .first()
    .waitFor({ state: "visible" });
  const visibleMs = performance.now() - start;
  const { profile } = await cdp.send("Profiler.stop");
  const completed = new Promise((resolve) =>
    cdp.once("Tracing.tracingComplete", resolve),
  );
  await cdp.send("Tracing.end");
  const { stream } = await completed;
  let trace = "";
  while (true) {
    const piece = await cdp.send("IO.read", { handle: stream });
    trace += piece.data;
    if (piece.eof) break;
  }
  await cdp.send("IO.close", { handle: stream });
  const parsed = JSON.parse(trace);
  const events = parsed.traceEvents
    .filter((event) => event.ph === "X" && event.dur > 30000)
    .map(({ name, dur, ts, tid, pid, args }) => ({
      name,
      durationMs: dur / 1000,
      ts,
      tid,
      pid,
      args,
    }))
    .sort((a, b) => b.durationMs - a.durationMs);
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const samples = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    const n = nodes.get(profile.samples[i]);
    const key = `${n.callFrame.functionName} ${n.callFrame.url}:${n.callFrame.lineNumber + 1}`;
    samples.set(key, (samples.get(key) || 0) + (profile.timeDeltas[i] || 0));
  }
  const functions = [...samples.entries()]
    .map(([functionName, microseconds]) => ({
      functionName,
      sampledMs: microseconds / 1000,
    }))
    .sort((a, b) => b.sampledMs - a.sampledMs)
    .slice(0, 25);
  const imageEvents = parsed.traceEvents
    .filter((event) =>
      /Image|Resource(SendRequest|ReceiveResponse|Finish)/i.test(event.name),
    )
    .map(({ name, dur, ts, tid, pid, args }) => ({
      name,
      durationMs: dur / 1000,
      ts,
      tid,
      pid,
      args,
    }));
  const browserImages = await page
    .locator("img")
    .evaluateAll((images) =>
      images.map((image) => ({
        src: image.currentSrc,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        width: image.width,
        height: image.height,
      })),
    );
  const imageResources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter(
        (resource) =>
          resource.initiatorType === "img" ||
          /\.(png|webp|jpg)/.test(resource.name),
      )
      .map((resource) => ({
        url: resource.name,
        initiatorType: resource.initiatorType,
        decodedBodySize: resource.decodedBodySize,
        duration: resource.duration,
        startTime: resource.startTime,
        responseEnd: resource.responseEnd,
      })),
  );
  const output = {
    visibleMs,
    events,
    functions,
    imageEvents,
    browserImages,
    imageResources,
  };
  const label = process.argv[2] || "trace";
  await writeFile(
    `outputs/resolution-navigation-20261127/${label}-trace-summary.json`,
    JSON.stringify(output, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        visibleMs,
        events: events.slice(0, 5),
        functions: functions.slice(0, 5),
        imageResources: imageResources.filter((resource) =>
          resource.url.includes("/icon.png"),
        ),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
