# Department portraits, biographies and directory cards

The public `/departments` directory and `/departments/[slug]` detail page now use `head_photo`. Missing or failed photos reuse the existing neutral OfficialPhoto silhouette; neither page falls back to a department logo. Uploaded files and the `image_url` field remain unchanged and editable in Superadmin. The homepage retains its compact department-image variant.

Portraits reserve a 3:4 box with cover fit and center-top positioning. The detail portrait is limited to 300px, with information alongside it on desktop and stacked on mobile. Complete biographies use preserved line breaks and natural wrapping. About, News, Programs, Contacts, slugs, publication filters and permissions remain intact.

Department directory cards use flexible equal-height grid items, full wrapping names, three-line descriptions and bottom-aligned actions. News/Activities directories use the shared NewsGrid uniform variant with 16:9 images, three-line excerpts and bottom-aligned links. Homepage news and compact department news retain their existing variants. Text is clamped only in CSS; saved content is unchanged.

## Biography editing

Both department forms share the optional biography input, live `length / 800` counter, HTML maxlength and validation messaging. Both server save paths independently reject input above 800 characters. Windows CRLF form line endings are normalized to LF before counting/saving so an 800-character multiline biography is accepted consistently. Existing oversized text remains visible for manual correction; it is never sliced to fit. Superadmin department rows flag any existing biography above the limit.

Run the read-only audit with `node --env-file=.env.local scripts/check-department-biographies.mjs`. It reports only the department identity and character count for oversized records, never full biographies or credentials. The audit on October 13, 2026 checked 18 departments and found zero biographies over 800 characters. No live data changed.

No migration is required. The application enforces the new editorial limit; existing database fields/constraints remain unchanged, preserving compatibility with historical content. Deploy the application update after the existing migration-012 baseline. Direct database edits must also respect the editorial limit.

## Files

- Public routes: `app/(public)/departments/page.tsx`, `app/(public)/departments/[slug]/page.tsx`.
- Shared presentation: `components/departments/DepartmentGrid.tsx`, `components/officials/OfficialPhoto.tsx`, `components/news/{NewsCard,NewsDirectory}.tsx`, `app/globals.css`.
- Biography input/validation: `components/admin/DepartmentBiography.tsx`, `lib/content/department-biography.ts`, `lib/admin/content.ts`, `app/admin/content/ContentForm.tsx`, `app/superadmin/departments/{OfficeForm.tsx,actions.ts,page.tsx}`.
- Audit/tests: `scripts/check-department-biographies.mjs`, `tests/data/department-biography.spec.ts`, `tests/department-portraits.spec.ts`, `tests/dynamic-department-admin.spec.ts`, `tests/portal.spec.ts`, administration test configuration.

## Verification

- All 111 data tests passed; the biography boundary test was rerun after adding CRLF coverage and passed.
- TypeScript, lint and production build passed.
- Existing public browser suite: 16 desktop/mobile scenarios passed.
- New responsive news-card scenarios: desktop and mobile passed, each checking 1440px, 768px and 390px widths.
- Portrait geometry/placeholder scenarios: desktop and mobile passed at all three widths; screenshots were reviewed.
- Biography browser scenarios passed on desktop and mobile, including both server actions and complete public biography text.
- Broader dynamic-department workflow: incomplete. The final desktop rerun reached the department page navigation but exceeded its 180-second total timeout waiting for the load event. The remaining run was stopped. Do not treat this suite as passed; focused portrait/biography checks above passed independently.

Browser workflows use the isolated Supabase transport fixture; they do not write to the live database. The Windows public test-server teardown was interrupted after both new news assertions passed; that command exited 1 despite passing assertions. Earlier runs exposed and corrected the biography field accessible label and CRLF counting; an initial Chrome navigation interruption and the longer workflow's original 90-second timeout required targeted reruns. The existing contact-delete assertion was corrected to expect the preserved office query parameter. No live writes or deployment were performed.

### 3:4 portrait update

Changed both public portrait containers to 3:4. Production build passed. The focused portrait browser scenario passed at 1440px, 768px and 390px; desktop/mobile screenshots were reviewed. The test server required interruption during Windows teardown after the assertion pass.
