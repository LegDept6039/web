# Public council session pages

Each session card on `/legislative/sessions` and the Legislative overview links to `/legislative/sessions/[id]`. A session page includes its date, description, passed ordinances and resolutions, agenda items/documents, and minutes. Document details link back to the session, and the session's back link retains the selected term.

The page uses the existing published records. Numbered measures must explicitly reference that session, match its Legislative office, term and date, and have an Approved or Adopted status. Matching by date alone is intentionally avoided because different sessions can occur on the same day. Historical unassigned sessions only show linked records whose term is also unassigned.

Agenda and minutes come from published, nondeleted Legislative Documents linked to the session. They can have different document dates, such as an agenda circulated before the meeting or minutes published afterward. Legacy agenda items saved directly on the session also appear. Executive Orders, drafts and documents from another session or office do not appear.

Staff can add agenda/minutes using the existing CMS Documents form: select the document type and session, enter its content, and optionally upload a PDF. The public page shows an empty state until records are published. It links to the full document and offers the existing PDF when supplied.

Reads use the publishable-key content adapter and indexed session references, with pagination and server-side office/term/date filters. Database errors do not fall back to samples. No migration, policy, existing record or upload changes are required.

Focused checks:

```powershell
node node_modules/@playwright/test/cli.js test --config playwright.data.config.ts tests/data/session-records.spec.ts tests/data/adapter.spec.ts
node node_modules/next/dist/bin/next build
node node_modules/@playwright/test/cli.js test --config playwright.session-detail.config.ts
```

The browser suite uses an isolated opt-in transport fixture, including desktop/mobile navigation, attachments, empty sessions, inaccessible sessions, same-day sessions, and excluded records. It does not modify the hosted database.

Validation on November 26, 2026: 16 data checks and all six desktop/mobile browser scenarios passed, along with the production build, TypeScript and scoped ESLint checks. Desktop/mobile screenshots were reviewed. Next's streamed not-found responses may return HTTP 200; inaccessible-session checks require the not-found UI, `noindex` metadata and no exposed records.
