# Staff session lifetime (migration 013)

## Required setup

Apply the **contents** of `supabase/migrations/202611050013_staff_sessions.sql` in Supabase SQL Editor after migration 012, then deploy this application version. This migration has not been applied to the hosted project by this implementation. No new environment variables are needed. Existing signed-in staff must sign in again after deployment; login fails closed with a setup message if migration 013 is missing.

## Behavior

- `/admin`, `/superadmin`, and `/account` share the same protected staff session.
- A session expires after **60 minutes without interaction in the admin interface**. Pointer, keyboard, touch and scrolling activity can renew it, throttled to at most one renewal every 30 seconds. Merely leaving a page open or refreshing Supabase tokens does not renew it. Public-page browsing does not count as admin activity.
- Expiry hides the admin interface and calls the existing local Supabase sign-out action. Background/suspended tabs check the deadline when they resume. Failed verification locks the interface instead of extending the session locally.
- A tab marker lives in `sessionStorage`. Normal reloads and same-tab navigation retain it. Closing the tab and opening a fresh tab loses the marker and requires signing in again.
- This is a single-tab workflow. Cookies are shared across tabs: opening an admin tab without its marker signs out that browser session, including other tabs sharing those cookies. Signing out does not sign out other browsers/devices.
- Browsers can copy sessionStorage when duplicating a tab or restore it when restoring a closed tab/browser session. Those restored tabs may retain access until the inactivity deadline. JavaScript cannot reliably distinguish closing from reloading, and unload requests are not guaranteed to run. There is deliberately no unreliable unload/logout beacon. Closing the tab does **not** immediately revoke the server record; it expires on the server after the deadline unless explicitly signed out.

## Server enforcement

`currentStaff` still verifies Supabase Auth, the active staff profile and existing department permissions. It additionally checks the server-side session deadline before granting access. All existing protected pages/actions using `requireStaff`/`officeContext` inherit that check. The opaque session cookie is HTTP-only, SameSite=Lax, secure in production, and browser-session scoped. Only a SHA-256 hash is stored in the session table. The client-side tab marker is matched to that cookie before activity renewal.

Migration 013 adds `staff_browser_sessions` and three narrowly scoped RPCs. Authenticated users have no direct table privileges. RPCs check the authenticated identity; active sessions can renew, expired sessions cannot. Sign-out removes the current session record and clears the cookie even if the Auth service is unavailable. Historical content, departments, assignments, uploaded files and role/RLS rules are unchanged.

This is an application staff-session policy. It does not change Supabase JWT lifetimes or retroactively invalidate an already issued access token at every direct Supabase endpoint; existing RLS remains in effect. The browser receives no service-role key.

## Verification

Local SQL tests cover the 60-minute deadline, expired-session rejection, cross-user isolation, revocation, inactive staff and blocked direct table/anonymous access. Browser tests cover normal login/reload, a fresh tab after closing the original, and inactivity logout. Browser tests use the isolated Supabase transport fixture; SQL permission tests run the real migration in PGlite. Hosted Supabase/Vercel behavior has not been tested or deployed.

Validation results:

- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- `npm run test:data`: all 112 tests passed. The session SQL test was rerun with explicit active-session renewal coverage and passed.
- Login/session browser suites: 26 desktop/mobile assertions passed. Two additional desktop/mobile interaction-renewal scenarios passed (28 total).
- Windows test-server teardown remained running after the browser assertions, so the owned runners were interrupted; those commands exited 1 after passing assertions. No live migration or deployment was performed.
