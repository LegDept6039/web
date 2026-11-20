# Staff Password Reset (Migration 026)

## Deployment

Apply the **contents** of `supabase/migrations/202611200026_staff_password_resets.sql` after migration 025, then deploy this application version. The migration creates the private reset state and extends the existing authorization helpers. It does not change existing passwords, roles, account status, office assignments, content or files. This implementation has not applied a hosted migration or changed production accounts.

The existing server-only `SUPABASE_SERVICE_ROLE_KEY` is required for Auth Admin operations and signing the reset proof cookie. No new environment variable, email provider or Auth redirect configuration is required. Keep this key in the server environment; never add a public environment prefix or send it to a browser. Supabase documents `updateUserById` as a server-only operation. [Supabase Auth Admin reference](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid)

Deploy the matching migration and application together. If the reset status cannot be checked, staff access fails closed rather than bypassing the requirement.

## Superadmin Workflow

1. Verify the staff member's identity privately. Open **Superadmin > Users**, select their existing account, and click **Reset Password**.
2. Check the account name and email in the confirmation panel, select the identity-verification checkbox, then confirm **Reset Password**.
3. Copy the generated temporary password with **Copy temporary password** and give it to that staff member privately. The panel shows its expiry in Philippine time. **Done** clears the displayed password; it cannot be retrieved through the CMS afterward.
4. The staff member signs in at `/login` with the temporary password and goes directly to `/change-password`. They enter and confirm their own password, then select **Save password**.
5. On success they return to login with **Password updated. Please sign in with your new password.** Their next login opens the usual workspace with the original role and office permissions.

Temporary passwords expire 30 minutes after activation. Expiry is enforced by the portal's login, password-change action and database authorization gate; this does not rely on a Supabase per-password expiry setting. An expired reset tells the staff member to contact the Superadmin. Issuing another reset replaces the earlier temporary password and reset generation. A password operation already being issued or completed must finish before another can start.

The database must accept the password-change request before the deadline. Once accepted, that in-flight Auth operation may finish after the deadline so an already changed password is not stranded by a slow response.

The password policy remains 12 to 128 characters with matching confirmation, together with any policy enforced by Supabase Auth. The new password must differ from the temporary password. Until completion, the staff member can change the password or sign out; the page has no CMS navigation.

A reset never enables a disabled or deleted account. Disabled accounts are rejected. Role, Department, Legislative Access and Transparency assignments remain unchanged. A Superadmin changes their own password through **Your profile** (`/account`) using the current-password form; the assisted reset cannot target the initiating Superadmin. Ordinary staff cannot reset another account.

## Server and Database Enforcement

The server checks reset state before resolving staff access or performing protected actions. Bookmarked routes, forged action requests and already-open workspaces remain subject to the same checks. The existing staff session boundary removes access when it detects that a reset is required.

Migration 026 adds the reset gate to Superadmin, office and Transparency permission helpers, staff browser-session creation/checks and membership reads. Existing CMS table and Storage policies inherit those checks. Published content remains public through the existing public policies. The reset table and all state-changing reset RPCs are inaccessible to ordinary authenticated clients; clearing a flag in user metadata or submitting a direct table update cannot complete the reset.

Completion requires a server-signed proof tied to the authenticated user, current reset generation, Auth session and expiry. The server verifies that the supplied temporary password matches the stored digest before issuing that proof. Only the server can claim and finish a password change. The digest is removed at completion and is never included in audit records. The audit log records the initiating Superadmin, affected account and completion event with timestamps.

The Auth Admin password update revokes the user's existing sessions. The completion action also explicitly performs global sign-out **before** the update, while the supplied access token still identifies a live Auth session; doing it afterward could reject the token that the password update already revoked. This order follows the current Auth password-update behavior. [Supabase Auth Admin implementation](https://github.com/supabase/auth/blob/master/internal/api/admin.go), [password-update session revocation](https://github.com/supabase/auth/blob/master/internal/models/user.go)

Revoking refresh tokens alone does not immediately invalidate every previously issued JWT. Supabase explains this distinction in its [sign-out guide](https://supabase.com/docs/guides/auth/signout). The database therefore requires the JWT's `session_id` to match a live `auth.sessions` row created **after** reset completion. This cutoff blocks old sessions, refreshed tokens from those sessions, and sessions created during the password change. A new login after completion is required. The relationship between the JWT claim and `auth.sessions` is documented in [Supabase's session guide](https://supabase.com/docs/guides/auth/sessions).

The existing account password-change form uses the same operation lock and completion cutoff so it cannot race an assisted reset. Its successful change also signs the account out and returns it to login.

Application code does not log passwords, proof cookies or token values. `next.config.ts` sets `logging.serverFunctions: false` so development Server Function argument logging cannot print submitted credentials. The one-time display uses component state only, with no password in a URL or browser storage.

## Interrupted Auth Operations

Supabase Auth and the application database are separate operations. A timeout or lost response can leave the result unknown. The workflow intentionally retains `issuing` or `completing` and denies CMS access when it cannot confirm the outcome. It must not start a competing password write that could later be overwritten by a delayed request.

For a stuck operation, a system operator must verify that the external Auth request has ended and can no longer perform a delayed password update. Inspect the target's **current** reset generation and state using authorized server-side access. Only after that verification may the operator invoke the service-only `fail_staff_password_reset` RPC with the affected `p_user_id` and that exact `p_generation`. It marks the operation failed and clears the temporary digest while retaining the access restriction. The Superadmin can then issue a fresh reset normally.

Do not blindly unlock or retry an ambiguous request. Do not delete the reset row, set it to complete manually or disable authorization checks. A definitive Auth rejection is handled by the server's failure path; an unknown outcome needs the operator review above. Staff and Superadmin browser clients cannot invoke the recovery RPC directly.

## Verification

The full data suite passed **207 tests**, including reset state transitions, expiry/replacement, authorization and RLS, session cutoffs, audit preservation, disabled accounts, permission preservation and cryptographic proof validation. These tests use local PGlite databases and synthetic identities. The nine focused database tests passed again after the final grant hardening; full lint, standalone TypeScript checking and the production build also passed.

All **44 unique desktop/mobile browser scenarios** passed across the final full and focused runs: 36 existing login, session and account-management scenarios plus eight new reset scenarios. Coverage includes identity confirmation and copying the one-time password, mismatched entries, temporary-password reuse, expiry/replacement, bookmarked and direct CMS requests, an already-open session, an ordinary staff member replaying a reset action, disabled accounts, completion/auditing and restored original office permissions. The ordinary account password form also passed unchanged-password validation and a successful change afterward. Desktop/mobile screens were reviewed.

The first browser runs exposed overly broad alert selectors and navigation steps that interrupted a still-loading session check or attempted to click a button removed by a successful redirect. Those test steps now wait for the actual page state. The final focused run exited successfully. The browser scenarios use an isolated Supabase transport fixture and synthetic accounts in a local production build; they are not hosted Supabase Auth verification. No production accounts or content have been changed.

Useful commands:

- `npm run test:data`
- `npx playwright test --config playwright.data.config.ts tests/data/staff-password-resets.spec.ts tests/data/password-reset-crypto.spec.ts`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npx playwright test --config playwright.administration.config.ts tests/password-reset-admin.spec.ts tests/login-resolution.spec.ts tests/staff-session.spec.ts tests/administration.spec.ts`

