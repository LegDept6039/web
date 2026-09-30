# Municipality of Pinamungajan

A responsive municipal portal built with Next.js App Router, strict TypeScript, React, Tailwind CSS, and Lucide icons. Content is accessed through a provider-independent service layer, with local mock data and a Supabase PostgreSQL provider.

## Run locally

Requires Node.js 20.9 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:3000.

```sh
npm run test:data
npm run typecheck
npm run lint
npm run build
npm start
```

## Project structure

- `app/`: routes, metadata, global layout, loading, error, and not-found states.
- `components/`: reusable layout, home, legislative, news, official, and shared UI.
- `types/index.ts`: strict domain types.
- `data/`: mock municipal records and content.
- `lib/api/`: asynchronous data access boundary. Replace these functions with validated requests to the municipal backend/API without changing the presentational components.
- `public/images/`: local image assets and folders for future official photos.
- `tests/`: browser checks for navigation, search/filter combinations, document details, and mobile layouts.

The default mock mode requires no credentials. To connect Supabase, follow [the Supabase setup guide](docs/SUPABASE.md): create the project, run the supplied SQL migrations and optional seed, then configure `.env.local`. For staff authentication and the superadmin portal, follow [the account setup guide](docs/AUTH.md). Type `/login` directly into the address bar; the public website does not link to it.

## Pages and interactions

Home; Executive overview, Mayor, departments, programs, and activities; Legislative overview, members, sessions, ordinances, resolutions, committees, and hearings; News and individual articles; Services and individual guides; Transparency and document categories; Contact; site search.

Ordinance/resolution directories support keyword and year filtering, result counts, reset, empty states, and record detail links. Data collections have stable IDs so future API pagination can be added at the directory boundary. Sessions have expandable sample agendas. News supports keyword/category filtering. The navigation supports keyboard-accessible desktop dropdowns and a mobile menu.

## Content status

This is a development preview. Mock records and events are explicitly labeled. Official names, portraits, telephone numbers, email addresses, office hours, PDFs, committee assignments, and the adopted vision/mission still need municipal confirmation. The illustrated identity mark is a placeholder, not a reproduction of the official seal. Replace it with the authorized municipal seal before publication.

Document records accept optional PDF URLs. The included PDF is explicitly labeled as a shared demonstration attachment and contains no operative legal text. Replace it with verified record-specific documents before launch. Transparency categories without content show an intentional empty state.

Search engine indexing is disabled in `app/layout.tsx` while the site contains mock content. After content approval, change the `robots` metadata and provide the production canonical URL.

## Images and sources

The local hero photograph `public/images/municipality/pinamungajan.jpg` was retrieved from the Pinamungajan profile on Cebu Provincial Tourism:
https://tourism.cebu.gov.ph/explore/pinamungajan/

Source asset:
https://tourism.cebu.gov.ph/images/localized/a1ae910e-518819013-1244652647457585-697288695954043789-.jpg

The source is credited in the homepage image caption. Confirm reuse permission/municipal ownership before public release. The tourism feature links to the provincial tourism profile. News illustrations and the identity placeholder are original SVG assets made for this prototype. They do not depict actual municipal events or officials.

## Browser checks

```sh
npm run test:e2e
```

The test configuration uses installed Google Chrome. To use Playwright Chromium instead, remove `channel: 'chrome'` in `playwright.config.ts` and run `npx playwright install chromium`.

## Deploy on Vercel

Import this repository into Vercel, choose the detected Next.js framework preset, and deploy. The defaults (`npm install`, `npm run build`) are sufficient. Mock mode requires no environment variables. For Supabase mode, add `CONTENT_SOURCE`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` in Vercel and redeploy; see [the setup guide](docs/SUPABASE.md). Public deployment is not performed by this project scaffold.

For a future API, configure the API base URL server-side and update `lib/api/`. The frontend should call the municipal backend, never the database directly. Keep API secrets server-only. The Supabase adapter already validates responses, handles errors, and reads across API row limits. Replace it with an adapter for the municipal API when ready.

## Database integration

See [docs/SUPABASE.md](docs/SUPABASE.md) for the schema, content publishing, public media storage, Vercel configuration, testing, and future migration steps. No live Supabase project is connected until you complete that setup.
