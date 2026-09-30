# Staff login and superadmin setup

Staff sign-in is available only by entering `/login` in the address bar. The public header, footer, and pages do not link to it. Authentication and database policies protect accounts even if someone knows the URL.

## 1. Apply the authentication migration

Keep your existing content and media tables. Open `supabase/migrations/202609300003_auth.sql` in VS Code, select all of its contents, and copy them. In Supabase **SQL Editor > New query**, paste the **SQL contents**, then click **Run**. Do not paste the filename or Markdown backticks. Run this migration once, after `202609300001_content.sql` and `202609300002_media.sql`.

## 2. Create the first superadmin

1. In Supabase Authentication settings, disable **Allow new users to sign up**. This portal has no public registration form; accounts are provisioned by the administrator.
2. Open **Authentication > Users > Add user > Create new user**. Enter your email and a strong, unique password. Enable **Auto Confirm User** for this manually created account.
3. Open `supabase/bootstrap-superadmin.sql` locally. Replace `YOUR_EMAIL_HERE` with that exact email address.
4. Copy the complete SQL script into a new Supabase SQL Editor query and run it. This privileged dashboard operation enables your account and sets its role to `superadmin`.
5. Keep your configured `.env.local` values: `CONTENT_SOURCE=supabase`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY`. No new key, database password, or service-role secret is needed. Restart `npm run dev` after changing environment variables.
6. Type `http://localhost:3000/login` into your browser. Sign in with the account you created. On Vercel, use `https://YOUR_DOMAIN/login`.

## 3. Manage staff

Superadmins are sent to `/admin`; ordinary users are sent to `/account`.

Create additional users through Supabase **Authentication > Users > Add user > Create new user**, with email confirmation enabled as above. New accounts are disabled and have the `user` role, regardless of user metadata. In `/admin/users`, choose their role and enable their access. Share initial credentials with the intended staff member through your usual private channel.

- **User:** can sign in and view their own account. Cannot edit content or manage staff.
- **Superadmin:** can create, edit, publish, and delete content; can approve, disable, or change other staff roles.
- You cannot demote or disable your own superadmin account through the portal.
- Disabling an account removes its protected access on the next request, including for an existing session. Public published content remains publicly readable.
- Account creation and password resets are managed in the Supabase dashboard for this first version. There is no public signup, invitation-email workflow, or password-recovery page.

## 4. Manage content

Open a collection from `/admin`. New records start as unpublished drafts. Check **Published** to show them publicly. Existing IDs cannot be renamed. Concurrent edits are rejected if the record changed since the editor was opened; reload before trying again. Uncheck **Is sample** when replacing sample content with verified municipal content.

For images or PDFs, upload files through Supabase Storage to `municipal-media` and paste the public URL into the appropriate field. Images must be local paths or URLs from this project's municipal-media bucket. Storage uploads remain dashboard-only.

## Security and verification

Sessions use HTTP-only cookies, Secure in production, and private/no-store responses. Every protected page and mutation verifies the Supabase user and reads the current database role. RLS independently limits content writes to active superadmins. The public content adapter continues making anonymous requests so it cannot leak drafts when a superadmin browses the public website. Roles are never taken from user-editable metadata.

Supabase Auth applies its configured authentication rate limits. Configure stronger account protections in your Supabase project as needed. This implementation uses email/password authentication; it does not implement an MFA enrollment/challenge flow.

Run `npm run test:data`, `npm run typecheck`, `npm run lint`, and `npm run build`. Database tests cover role escalation, anonymous access, disabled accounts, and all content tables. After hosted setup, verify sign-in and sign-out with a real superadmin and a regular user; the automated local tests do not authenticate against your live project.
