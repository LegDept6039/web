# Connect the municipal portal to Supabase

The application now supports two content sources:

- `CONTENT_SOURCE=mock`: the existing local sample data. This is the default.
- `CONTENT_SOURCE=supabase`: published records from your Supabase project.

The public website reads data on the Next.js server through Supabase's REST Data API. There is no database password or privileged key in the app. Content can be edited in the Supabase Dashboard or through the protected superadmin portal. Follow [Staff login and superadmin setup](AUTH.md) to enable `/login` and `/admin`. There are no public navigation links to login.

## 1. Create a Supabase project

1. Sign in at https://supabase.com/dashboard and create a project.
2. Choose the organization, project name, database password, and region appropriate for your hosting requirements.
3. Wait for provisioning to complete.
4. In the project's Connect dialog / Settings, copy the **Project URL** and **publishable API key** (`sb_publishable_...`).

Use the publishable key only. Do not put the database password, secret key, or `service_role` key into this project. The code deliberately rejects non-publishable keys.

## 2. Create the tables

Open **SQL Editor ? New query**. Run these files in order, one at a time:

1. `supabase/migrations/202609300001_content.sql` — creates the content tables, constraints, indexes, timestamp triggers, and access policies.
2. `supabase/migrations/202609300002_media.sql` — creates the public `municipal-media` storage bucket.
3. Optional: `supabase/seed.sql` — inserts the existing sample content so the connected site has content immediately.

Run each migration once on a new project. If a table already exists, inspect the existing schema instead of dropping it. The optional seed can be rerun safely: `ON CONFLICT DO NOTHING` preserves existing records and edits. Seeded records are published but marked `is_sample=true` and contain fictional content.

## 3. Configure local development

Copy `.env.example` to `.env.local` in the project root and fill in:

```dotenv
CONTENT_SOURCE=supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

`.env.local` is ignored by Git. Do not commit it. These variables intentionally have no `NEXT_PUBLIC_` prefix because only the Next.js server needs them.

Restart your development server after changing these settings:

```sh
npm run db:check
npm run dev
```

`db:check` loads `.env.local` and makes read-only requests to all content tables. It prints table availability, not keys or record contents. If you have not created a project, leave `CONTENT_SOURCE=mock`; the site still works without configuration.

## 4. Manage and publish content

Use **Table Editor** in Supabase. New records default to `published=false` and are invisible to public visitors until you set that field to `true`.

| Table | Website content |
|---|---|
| `officials` | Branch leadership and council directory; optional `photo_url` |
| `news` | News listing, articles, executive activities, and search |
| `ordinances` | Ordinance directory and details |
| `resolutions` | Resolution directory and details |
| `sessions` | Council sessions and agenda lists |
| `hearings` | Upcoming and previous public hearings |
| `services` | Service directory and individual guides |
| `departments` | Department directory |
| `programs` | Programs and projects |
| `committees` | Standing committees |
| `document_categories` | Transparency categories |
| `municipal_documents` | Files listed in transparency categories |

Common fields:

- `id` (or `slug` for news): unique lowercase URL identifier, e.g. `health-outreach-2026`. Use letters, numbers, and single hyphens. Keep it stable after publication.
- `published`: only `true` records are publicly readable. Changing it to `false` withdraws the record on subsequent requests.
- `is_sample`: set to `false` for verified real content. This controls record-level sample labels.
- `sort_order`: lower numbers appear first, including on the homepage. Use a lower value for featured/new records.
- `created_at` / `updated_at`: managed automatically.

Other fields:

- Dates use `YYYY-MM-DD`. Legislative `year` must match `date_approved`.
- `content`, `agenda`, and `steps` are PostgreSQL text arrays. Example: `["First paragraph", "Second paragraph"]` in a JSON-style editor, or `{"First paragraph","Second paragraph"}` if the editor expects PostgreSQL array syntax. Content is rendered as plain text, not HTML.
- `branch`: `executive` or `legislative`.
- Session `type`: `Regular session`, `Special session`, or `Caucus meeting`.
- Hearing `status`: `Upcoming` or `Previous`. Update this value when a hearing concludes.
- `category_id` in `municipal_documents` must reference a `document_categories.id`. For a category that lists files, leave its `href` empty. `href` is for categories that redirect to another page, such as ordinances.
- Links are root-relative site paths or HTTPS URLs. Other protocols are rejected.

### Example: publish a new article

Create a `news` row with slug `barangay-service-update`, a title, category, date, excerpt, image, and content array. Set `is_sample=false` after verifying the content, then set `published=true`. Visit `/news/barangay-service-update` and `/news` after refreshing. New URLs do not require a redeploy.

Supabase mode uses uncached server reads, with request-level deduplication. Refresh an already-open page to see edits. A database/configuration failure shows the site's error state; the app never silently substitutes mock records when Supabase is selected.

## 5. Upload photos and documents

In **Storage ? municipal-media**, upload only files approved for public release. Copy a file's public URL into `image`, `photo_url`, `pdf_url`, or `file_url`, as appropriate.

The bucket accepts JPEG, PNG, WebP, and PDF files up to 10 MB. The Next.js image configuration permits images only from this project's `municipal-media` bucket. Prefer small optimized photographs. Existing `/images/...` and `/documents/...` paths continue to work.

**Every file in this public bucket is publicly accessible by URL, even when the database record referencing it is unpublished.** Never upload private drafts, personal records, or confidential attachments here. Private-file workflows need a separate private bucket and authorization; they are not part of this public portal integration.

Anonymous and signed-in website clients have no upload/edit/delete policies. Authorized project collaborators manage files through the Supabase Dashboard.

## 6. Configure Vercel

In **Vercel ? Project ? Settings ? Environment Variables**, add:

- `CONTENT_SOURCE` = `supabase`
- `SUPABASE_URL` = your Project URL
- `SUPABASE_PUBLISHABLE_KEY` = your publishable key

Select the environments that should use the database, then redeploy. Use a separate Supabase project for preview/testing content when needed; otherwise all deployments configured with the same project will display the same published records. No database connection string or additional Vercel build configuration is required.

Builds do not depend on database availability. Supabase reads run at request time. Incorrect configuration or a missing schema still needs to be fixed before the deployed pages can load.

## Validation

```sh
npm run test:data
npm run typecheck
npm run lint
npm run build
```

`test:data` checks the response contracts, paging across server row caps, safe URLs, missing configuration, failure behavior, and real PostgreSQL row-level security using a local PGlite test database. It creates no external resources and requires no Supabase credentials.

The PostgreSQL tests run the content migration and seed, verify seed reruns preserve edits, and test the authentication migration separately. Anonymous visitors and ordinary users cannot edit content or read drafts; active superadmins can manage all content collections. They do not emulate the hosted Supabase gateway or Storage service. After creating your real project, also run `npm run db:check` and verify a draft/published record through the deployed website.

## Future migration

The UI continues to call `lib/api/`. It receives provider-independent types from `types/index.ts`.

- `lib/content/repository.ts` selects the provider.
- `lib/content/supabase.ts` handles Supabase HTTP transport.
- `lib/content/schema.ts` validates responses and translates snake_case database columns into the UI's camelCase fields.
- `lib/content/mock.ts` preserves the local development/demo provider.

When the municipal backend is ready, add an adapter returning the same domain types and switch the repository to it. Export the PostgreSQL tables via a database backup or Table Editor CSV export, preserve IDs/slugs and category relationships, copy storage objects, and rewrite stored file URLs to the new public file host. Supabase grants/RLS and the Storage migration are provider-specific and must be adapted to the replacement backend. Verify access rules and record counts before switching production.

The current small-site directories load all published records for frontend filtering, paging through Supabase's API row limits. The reader fails explicitly after 200 batches rather than silently truncating. Move filtering/pagination into the provider interface when the municipal archive grows substantially.

## Remaining editorial content

The header, hero, vision/mission, contact details, mayor introduction, and general preview notices remain in the existing components. Connecting a database does not verify or replace those texts. Review them, official branding, sample documents, and `robots` metadata before an official launch.

## Official references

- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/storage/buckets/creating-buckets


