# Municipal Contact Management

Apply the **contents** of `supabase/migrations/202611190023_municipal_contact_settings.sql` in Supabase SQL Editor after migration 022. The application does not apply hosted migrations automatically. Until this migration is installed, the editor shows a setup message and the public department contact directory remains available.

Open **Superadmin > Municipal Contact** (`/superadmin/contact`) to edit the municipality name, address, telephone, email, office hours, social link and Google Maps embed URL. Saves appear on `/contact`; there is no separate draft or publish step. Name and address are required. Blank optional details are hidden. Address and office hours preserve line breaks.

The initial map is the supplied Pinamungajan Municipal Hall location. To replace it, paste the URL from a Google Maps embed's `src` attribute, not the full iframe HTML. The editor accepts HTTPS Google Maps embed URLs and renders a responsive, lazy-loaded iframe. Clearing the URL hides the map.

Only active Superadmins can open the editor or save changes. The server action and database RLS independently enforce this. Saves use the existing audit log and timestamp trigger; an outdated form cannot overwrite a newer save. Public reads use the publishable key and fresh request data.

This adds one municipal settings record. Existing department contacts continue to be managed in their department workspaces and displayed by the existing public directory rules. No existing content, office assignments or files are changed.

## Verification

Production build, standalone TypeScript, full lint and all 174 data tests passed, including nine tests for settings validation, public reads, SQL permissions, audit logging and stale-update protection. All eight desktop/mobile browser scenarios passed: saves and fresh public reads, map attributes, invalid URL handling, hidden blank details, stale-save rejection and non-Superadmin access denial. Form and public layouts were reviewed on both screen sizes with no horizontal overflow.

Browser verification uses the isolated Supabase transport fixture and stubs external Google map requests; it does not verify hosted Supabase or live Google Maps availability. The stale-edit scenario uses separately authenticated browser contexts to respect the existing tab-bound staff login. The temporary Windows test server was stopped after all assertions finished; the final test command exited successfully.
