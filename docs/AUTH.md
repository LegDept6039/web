> Migration **009** consolidates the Department system. See [Dynamic departments](DYNAMIC-DEPARTMENTS.md) for the current architecture and deployment steps.

> Current department scoping and public routes require migration **008**. See [Department implementation](DEPARTMENT-IMPLEMENTATION.md) for upgrade instructions and verification.

# Staff authentication and office administration

> Current model: Legislative has one office, **Legislative Access**, using the same office permissions as Executive offices. Apply migration 007 after 001-006. See [current setup](LEGISLATIVE-IMPLEMENTATION.md). No module permissions or separate SB/VMO/Secretary access remain.

The public website has no login link. Enter `/login` directly. Login has a standalone layout. `/admin`, `/superadmin`, and `/account` use a separate sidebar/topbar layout, without the public header or footer.

## Upgrade an existing installation

1. Back up your database. Keep the existing migrations and content; do not drop tables or rerun older migrations.
2. Open `supabase/migrations/202610010004_office_access.sql` in VS Code. Copy **all SQL contents**, paste into Supabase **SQL Editor > New query**, and run once. It requires migrations `202609300001_content.sql`, `202609300002_media.sql`, and `202609300003_auth.sql` to have been applied already.
3. The migration preserves existing Super Admins, converts the old `user` role to `viewer`, adds 16 initial offices, and leaves existing content's `office_id` null. Only Super Admins can manage unassigned content. Assign ownership deliberately through Content Management; the migration does not guess ownership.
4. Apply migrations `202610010005_legislative_modules.sql` `202610010006_official_photos.sql`, and `202610010007_single_legislative_access.sql` as described in [the Legislative setup guide](LEGISLATIVE-IMPLEMENTATION.md), then deploy the matching application.
5. Fill `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and in Vercel. Restart locally; redeploy on Vercel after setting variables.
6. Disable **Allow new users to sign up** in Supabase Authentication. Create subsequent staff accounts through `/superadmin/users/new`.
7. Sign in at `/login`. Super Admins land at `/superadmin`; other enabled staff land at `/admin`.

If starting from a new project, apply migrations 001 through 007 in order. Optional `supabase/seed.sql` provides clearly marked sample content. Create the first Auth account once through Supabase Authentication and run `supabase/bootstrap-superadmin.sql` after replacing its email placeholder. Authorization is stored in `staff_accounts.role`, never hardcoded to an email in application code. All later users can be created from the website.

## Required environment variables

```dotenv
CONTENT_SOURCE=supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_KEY
```

The administration key accepts a modern `sb_secret_...` key or the legacy `service_role` JWT from the **same Supabase project**. It must not have a `NEXT_PUBLIC_` prefix, appear in browser code, be committed to Git, or be placed in the publishable-key field. The publishable content client still rejects privileged keys. Auth is now configured from the Supabase URL and publishable key independently of `CONTENT_SOURCE`; mock public content no longer disables configured authentication.

The privileged client is isolated in `lib/auth/admin.ts` with `server-only`. It is used only for Auth account creation, rollback of failed creation, and administrator password resets, after checking the signed-in user's database Super Admin role. Content and application-profile operations use the user's session and RLS, never the privileged client.

## Vercel and Supabase configuration

For the current deployment, use `https://legislativedept6039.vercel.app` as Supabase **Authentication > URL Configuration > Site URL**. Keep `http://localhost:3000` for local testing in the redirect allowlist as appropriate. Add an exact trusted preview domain if testing a separate Vercel Preview deployment. Do not allow arbitrary third-party redirect hosts.

This implementation signs in with email/password and resets passwords directly through the authenticated administration server action. It does not send reset emails or use OAuth/PKCE email callbacks, so there is no `/auth/callback` route to configure for these flows. Adding email recovery later will require a verified callback/token flow and matching redirect URLs.

In Vercel **Project > Settings > Environment Variables**, configure the four variables above for **Production** and the Preview/Development environments you actually use. Local `.env.local` is not uploaded to Vercel. Redeploy after changes. Use the same project's URL and keys. HTTPS production responses use Secure, HttpOnly, SameSite=Lax cookies and private/no-store caching. Each proxy request verifies/refreshes Supabase authentication; protected pages and actions independently check current roles.

Deployment inspection during this change found `/login` returned HTTP 200 with an enabled form and the old public header. No specific failed-login response, authenticated production session, or Vercel environment access was available, so the previous production failure's root cause is **not established**. The local project had a URL and publishable key but no administration key. Read-only REST checks returned 401 for the private staff table (expected for anonymous access) and 404 for the not-yet-created office tables. This is not evidence of a password failure.

Run `npm run auth:check` locally for diagnostics without printing credentials or staff records. An absent admin key does not prevent ordinary login, but blocks website user creation and administrator password resets. If login still fails in production, check Vercel Function logs, confirm all migrations exist in the matching project, check the account is active and not deleted, and verify its email is confirmed. Never paste passwords or secret keys into issue reports.

## Roles and office levels

`staff_accounts` remains the application profile table, with `user_id` referencing `auth.users`, `display_name`, email, role, active/deleted status, and timestamps. No duplicate profiles table or single-office column is introduced.

| Global role | Office viewer                   | Office editor        | Office manager               |
| ----------- | ------------------------------- | -------------------- | ---------------------------- |
| Viewer      | Read                            | Read                 | Read                         |
| Editor      | Read                            | Read, create, update | Read, create, update         |
| Admin       | Read                            | Read, create, update | Read, create, update, delete |
| Super Admin | Everything, without assignments | Everything           | Everything                   |

The document's global "manager" example is represented by the **Admin** role. **Manager** is the per-office permission level. Both role and office level must allow an action. Deactivated offices and disabled/deleted users lose administrative access on the next request. Public published content remains visible. Editors may publish their authorized office's content; no approval workflow is implied.

All 12 existing content collections now have nullable `office_id` and `created_by`. Only Super Admins can transfer office ownership. New content's author is set from the authenticated identity by a database trigger, overriding forged author input. Historic content keeps its unknown author as null. Existing public URLs, IDs, and content adapters are preserved.

## Managing users

At `/superadmin/users` choose **+ Add User**, enter a name, email, password/confirmation, role, enabled status, and office assignments grouped by Executive/Legislative. Accounts are created with confirmed email for administrator-provisioned staff. Share credentials privately. Passwords are handled by Supabase Auth and never stored in application tables or audit logs.

Edit an account to change its name, role, status, or office permissions. Email is read-only to preserve Auth/profile consistency. Office assignments are updated in one database transaction. Users cannot grant themselves access, and Super Admins cannot demote, disable, or delete their own account through the portal.

**Delete account** is a soft delete: disables portal access, removes office assignments, retains Auth identity and historical content authorship. Auth tokens may still exist, but database authorization denies protected access. Public reading remains possible like any visitor. Saving the account without Delete restores it; reassign offices as needed. Permanent deletion is not provided.

Use **Reset password** to set a new password without opening Supabase. This does not send an email. Staff can change their own password under Profile after entering their current password. Existing tokens are not treated as authorization: active/profile/office checks run on every protected request. Disable an account immediately if access must be revoked.

## Offices and content

At `/superadmin/offices`, create/edit offices, choose Executive or Legislative, and activate/deactivate them. The database supplies all office selectors and assignments, including newly added offices. Offices with staff assignments or content cannot be deleted; deactivate them or reassign references first. Deactivation does not automatically unpublish existing public content.

Choose an office on `/admin`, then a content collection. Viewers see read-only forms. Editors and admins see actions allowed by both their global role and office level. List and detail pages explicitly exclude unrelated administrative records even though RLS permits everyone to read published public records. Every mutation also checks ownership on the server, and RLS independently rejects unauthorized direct API requests. Concurrent content/office edits use `updated_at` checks to avoid overwriting a newer version.

Uploads remain in Supabase Storage's `municipal-media` bucket through its dashboard. Content forms accept its public URLs. This public bucket is not for confidential documents.

## Audit log

`/superadmin/audit` shows account changes, office CRUD, office permission changes, content CRUD, and administrator password resets. Database triggers capture writes including direct API mutations; audit records cannot be edited or deleted through an authenticated client. Audit rows store action summaries and actor/entity/office identifiers, not full content or passwords. Initial provisioning may appear as System because Auth Admin requests do not carry an end-user JWT; subsequent access assignment records carry the acting Super Admin. Database owners remain able to administer the database; this is not an external tamper-proof archive.

## Verification

```sh
npm run test:data
npm run typecheck
npm run lint
npm run build
npm run test:admin
npm run test:public
npm run auth:check
```

Database tests execute migrations in an isolated PostgreSQL-compatible engine and exercise all 12 collections: Super Admin access, MPDC-only editor, multi-office Admin, read-only viewer, forged office IDs/authors, role escalation, office deactivation, soft deletion, safe office deletion, and audit protections. Earlier migration tests stay in place as upgrade baselines.

`test:public` checks the existing public navigation, content directories, search, details, and responsive layouts against mock public data.

`test:admin` uses an isolated test-only Supabase transport (no live accounts or emails) to exercise actual login cookies, route redirects, role-specific screens, website user creation, and password reset actions on desktop/mobile. The fixture is loaded only by its Playwright server configuration, never imported by application code. It does not substitute for the database RLS tests or a hosted integration test.

After applying the migration and deploying, verify with real test accounts:

1. Super Admin can create a user and office, assign permissions, edit content, and reset a password.
2. An MPDC Editor can edit MPDC content but cannot access Mayor/Assessor/Vice Mayor records or `/superadmin/users`.
3. An Admin with Manager access to MPDC and Assessor can manage both, not unrelated offices.
4. An SB Viewer can view SB drafts but cannot create, update, or delete.
5. Logged-out `/admin` and `/superadmin` redirect to `/login`.
6. Logout, refresh, then revisit a protected URL; it remains protected.
7. Repeat on the Vercel Production domain, including a refresh/session persistence check. No authenticated hosted test was performed automatically.

See `docs/ADMIN-IMPLEMENTATION.md` for the file inventory and architecture notes.


## Staff inactivity and tab sessions

See [STAFF-SESSIONS.md](STAFF-SESSIONS.md) for migration 013, the 60-minute inactivity deadline, tab behavior and deployment steps. Apply migration 013 before deploying the updated authentication flow.

## Transparency assignments

Migration 018 adds an explicit Transparency assignment to the existing staff account. Apply it after 017 before running this application version. Superadmin assigns it through Users & access control by selecting Transparency in Office Access. Assigned Editors/Admins manage modules and reports; assigned Viewers are read-only. These users may sign in without an office membership, and other office access remains independent. See [TRANSPARENCY.md](TRANSPARENCY.md) for setup, revocation and verification details.
