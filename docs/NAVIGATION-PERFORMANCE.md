# Council Members Navigation Measurement

Measured on November 19, 2026. The application change is limited to `app/(public)/legislative/members/page.tsx`: start the independent Legislative Terms and Officials reads together with `Promise.all`, then apply the same role and selected-term filters.

## What the terminal timing means

In the installed Next.js 16.3.6 source (`node_modules/next/dist/server/dev/log-requests.js`), the total is request end minus request start. `application-code` is request end minus the end of framework processing, including awaited network requests and rendering/streaming. It is not CPU time or browser click-to-content time. Development compilation and instrumentation also differ from a production build.

Next strips the internal RSC query from the displayed URL, so a `GET /legislative/members` log alone does not indicate a full-page reload. The preceding `checkStaffSession` and `logout` actions are separate requests. Public Legislative routes do not run through the staff-only proxy matcher or session boundary.

## Before and after

Both phases used a local production build (`next build`, then `next start` on port 3004), the same real Supabase database, Chrome at 1440 x 1000, no artificial network/CPU throttling, and normal Link prefetching. Builds, lint and type checks were finished before measuring. The existing development server remained running in both phases.

For each phase: one warmup excluded, then seven trials, each with a fresh anonymous browser context. Open `/legislative`, wait for the page and network to settle, open the header's Legislative menu, wait 250 ms, then click **Council members** to navigate to `/legislative/members` without a term query.

The browser metric begins at the actual captured click and ends at the animation frame after the destination's first roster card is visible in the viewport. It measures main-content appearance, not portrait download completion or LCP. All trials rendered 11 official cards.

| Median metric | Before | After |
| --- | ---: | ---: |
| Click to visible roster | 560 ms | 382 ms |
| Destination RSC request through response completion | 461 ms | 264 ms |
| Supabase read window, first read start to last cloned body read completed | 384 ms | 186 ms |
| Gap between starting terms and officials requests | 194 ms | 13 ms |

Click-to-content improved by about **32% (178 ms)**. Ranges were 401-611 ms before and 295-455 ms after. These are local production measurements with normal network variation, not Vercel measurements or a direct before/after comparison against the user's 1,480 ms development log.

Raw click-to-content samples in trial order (ms):

- Before: 610.8, 560.3, 511.5, 610.3, 401.3, 450.1, 601.7.
- After: 307.4, 295.3, 342.9, 382.2, 423.6, 438.1, 454.5.

## Cause and preservation

The destination waited for the terms response before starting the officials response, although neither fetch needs the other's result. The Supabase wait occupied most of the destination request. After the change both requests overlap.

Every measured destination render fetched terms once (224 response bytes) and officials once (5,201 response bytes), with no extra pagination or duplicate Supabase reads. Link shell-prefetch requests also occurred before clicking; the page data was fetched on navigation. The source Legislative overview independently reads these tables as part of its own uncached render.

All trials kept the same browser document (`performance.timeOrigin` unchanged) and made zero document requests during the transition. Navigation was already using Next Link. Header, footer and public layouts introduced no database or authentication waits.

No cross-request caching was added. Both reads retain `cache: "no-store"`; React's existing repository cache only deduplicates within a render. New published edits continue to be read on the next server request, while officials still use `published=eq.true` and existing anonymous RLS. CMS writes, permissions, selection rules and page design are unchanged. No hosted content was edited or published for the measurement.

## Evidence and reproduction

Local, gitignored diagnostic artifacts are in `test-results/navigation-perf/`: `measure.mjs`, `trace-fetches.mjs`, `summarize.mjs`, `before/after-browser.json`, `before/after-server.jsonl`, `summary.json`, and before/after screenshots. These diagnostics are not imported by the application. The fetch trace records table, timing, status, byte count and publication-filter presence, never headers, credentials or response content. Body cloning/logging overhead is present in both phases. Trace attribution uses each destination request's time window; every trial was checked to contain exactly the two expected reads.

To repeat with the retained diagnostic scripts, build first, then start the isolated server in one terminal:

```powershell
$env:PORTAL_PERF_LOG='test-results/navigation-perf/after-server.jsonl'
node --import=./test-results/navigation-perf/trace-fetches.mjs node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3004
```

In another terminal run `node test-results/navigation-perf/measure.mjs after`, followed by `node test-results/navigation-perf/summarize.mjs before after`. Stop only that isolated server with Ctrl+C when finished. Repeating `before` requires the original sequential page implementation and a separate rebuild; rerunning labels against the same implementation is not an A/B comparison.

Without the local scripts, use Chrome DevTools Performance with screenshots enabled, record the same menu click, and measure from the click event to the first screenshot showing the roster. In Network, retain Fetch/XHR and Document requests and inspect the destination RSC request's Timing tab. Use the same build, viewport, cache/prefetch conditions and throttling for both versions.

## Validation

- `npm run build`, `npm run typecheck` and `npm run lint`: passed.
- `npx playwright test --config playwright.data.config.ts adapter.spec.ts`: 10 passed, including uncached reads and publication filtering.
- `npx playwright test --config playwright.terms.config.ts --grep 'public terms show'`: 2 passed, desktop and mobile. Current, previous and unassigned rosters, hidden draft officials, committee membership and overflow checks passed. These regression checks use the isolated Supabase fixture, separately from the real-data performance benchmark.
- Before/after production screenshots reviewed: roster and design unchanged. `git diff --check` passed.

The Windows browser-test server needed manual shutdown after the assertions completed; the test runner then exited successfully. Temporary benchmark/test servers were stopped. The user's development server was left running. No migration or deployment was performed.
