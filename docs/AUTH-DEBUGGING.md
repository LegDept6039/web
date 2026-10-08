# Login investigation (2026-10-06)

## Confirmed findings

The former `Your staff access is not enabled` message was returned by `app/login/actions.ts` only **after** `auth.signInWithPassword` returned a user without an Auth error. The same condition combined a failed `staff_accounts` query, no visible row, inactive/deleted status and an unsupported role. It did not query department membership. Thus that message alone did not diagnose disabled access or Legislative permissions.

A read-only audit of the project configured in the local Next.js environment found four Auth users and four staff profiles, all linked by Auth UUID, no missing profiles or email/UUID mismatches, two active Superadmins and no active ordinary staff lacking an active department assignment. Auth Admin and staff/department/membership reads succeeded; anonymous staff reads were denied (42501). No credentials or personal records were printed. These observations concern that configured project, not independently verified Vercel configuration or an affected user's authenticated request.

User provisioning is already correct in `app/superadmin/users/actions.ts`: Auth Admin `createUser` returns a UUID; the Auth trigger `portal_sync_staff` creates the corresponding profile; `manage_staff` uses that UUID for role/status/membership. It compensates failed access setup by removing the newly provisioned Auth identity. No second user table or email-based linking was added.

Auth and content configuration use the same SUPABASE_URL and publishable key. `office_id` and `user_office_access` remain valid current schema names after migration 009. No login query referenced a removed staff/profile table. Root `proxy.ts` refreshes sessions; pages/actions still independently verify Auth and staff access.

## Changes

- `lib/auth/resolve-staff.ts` is shared by login and currentStaff. It distinguishes profile query failure, absent/invisible profile, UUID mismatch, disabled/deleted account, unknown role, membership query failure and no active department assignment.
- Active Superadmins return before membership queries. Other staff use current `user_office_access` and `departments` records, with no department-specific login conditions.
- `lib/auth/diagnostics.ts` records failure stage, safe error code/status, redacted database SELECT error message and user/project fingerprints. It never logs passwords, keys, session tokens, full Auth users or full profiles.
- Supabase credential errors remain authentication errors. Database failures no longer masquerade as disabled accounts. A rejected post-login resolution signs out locally; protected requests use the same resolver.
- No RLS policies, account roles, memberships or production data were changed.

## What remains unconfirmed

The exact hosted/profile-query error that caused the reported failed attempt is still unknown. Service-role reads bypass RLS and cannot establish that the affected session can read its own profile. The checked-in migrations allow authenticated self-profile and self-membership reads, verified locally in PostgreSQL/PGlite; live policy drift or a different Vercel project/build must be checked with evidence. Do not claim that the reported live incident is resolved solely from fixture tests.

## Capture one failing attempt safely

1. Use the updated application in the environment where the failure occurs. Failure logs are enabled without a new variable. Optionally set `AUTH_DEBUG=true` server-side for success-stage/session-presence diagnostics, restart locally or deploy explicitly when authorized, and return it to false after diagnosis.
2. Retry login. Record the displayed error and the matching `[portal-auth]` log entry in the local server terminal or Vercel runtime logs. Share only stage/outcome/code/status/redacted databaseMessage and fingerprints, never credentials/cookies/tokens.
3. Compare project fingerprints between local and Vercel and confirm the deployed commit. Check URL/key project pairing, environment scope and Supabase Site/redirect URLs; no specific Vercel variable correction has been established by this investigation.
4. `42501` indicates privileges/policy helper access; `42P17` suggests policy recursion; `42703`/`42P01` or PostgREST schema-cache errors indicate schema/version drift. Preserve the original error when determining the repair.
5. For a read-only policy inspection, run the contents of `scripts/inspect-auth-rls.sql` in SQL Editor. It inspects policies/grants and simulates an active Superadmin's self-read inside a read-only transaction; it does not change policies or users. Repeat with the affected UUID if needed. A missing visible row may indicate absent linkage OR RLS filtering, not automatically inactivity.

No SQL migration is justified yet. Do not broaden RLS or use a service-role client to bypass a failed login profile lookup. No production deployment or migration was performed.

## Invalid refresh token recovery

`refresh_token_not_found` means Supabase rejected the refresh token from a saved session. It does not establish that the password is wrong or that staff permissions are disabled, and it does not by itself explain the earlier post-password profile error.

The proxy now handles `refresh_token_not_found` and `refresh_token_already_used` by expiring this project's session cookie and all numeric cookie chunks, removing them from the current request as well. Protected pages then follow the existing login redirect. Cookie updates from successive SDK callbacks are preserved. Other projects' cookies and the PKCE verifier are not removed. Temporary network failures do not trigger this explicit cleanup. Supabase may still log the initial rejected refresh attempt internally.

Reload `/login` and sign in again after restarting the updated local app. Hosted environments need the updated code deployed. For immediate recovery on an older deployment, clear cookies for that site or use a private browser window and sign in. No SQL migration or role change is needed for this recovery.

Recovery validation: build, standalone typecheck, lint and three diagnostic/session-cookie tests passed. The stale chunked-cookie browser scenario reported passing assertions on desktop and a separate mobile run: protected-page redirect, cookie removal, unrelated-cookie preservation, fresh password login and authenticated reload. Windows test teardown stalled after assertions; these are local fixture results, not live deployment verification. The first build encountered malformed generated `.next/dev/types` files; removing the two generated files and rebuilding resolved that unrelated build failure.

### Earlier login validation

See `tests/login-resolution.spec.ts` for Superadmin without membership, Legislative editor, department editor, inactive account, invalid credentials, missing profile, no membership, invalid role and profile/membership query errors. Database tests exercise self-profile/membership RLS after migrations through 010 and retain cross-department boundaries. Diagnostics tests check credential redaction. Browser transport fixtures are isolated; they do not prove live hosted login.

Validation completed: production build, standalone typecheck and lint passed; all 10 targeted data/diagnostic tests passed; all 28 desktop/mobile login and administration scenarios reported passing assertions. Windows browser-server teardown remained running and the owned session was interrupted after collecting results (command exit 1 from teardown). The live audit was read-only; no real account login was attempted without the user's credentials.
