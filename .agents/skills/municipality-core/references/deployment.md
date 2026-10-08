# GitHub -> Vercel, with Supabase

Keep the repository intentionally connected to the Vercel project as the deployment source; do not create a duplicate repository. Local implementation is not authorization to deploy or run live migrations. Report what was prepared, tested locally and actually applied separately.

When local behavior differs from Vercel, inspect configuration before redesigning code:

1. Check the affected Vercel environment (Production/Preview/Development), deployment commit and build/runtime logs.
2. Check `CONTENT_SOURCE=supabase`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and the server-only `SUPABASE_SERVICE_ROLE_KEY` for account creation/password resets. Use one Supabase project; never print values or expose privileged keys through client code or `NEXT_PUBLIC_`.
3. Check deployed Supabase project URL, applied migrations, Auth Site URL and exact trusted redirect URLs for the environment. Confirm the current deployment domain rather than assuming an old documented URL.
4. Trace `proxy.ts`, `lib/auth/config.ts`, `lib/auth/server.ts`, server/client boundaries and cookies. Production cookies are Secure, HttpOnly, SameSite=Lax; protected pages/actions recheck live staff status.
5. Inspect production API errors and session refresh behavior. `.env.local` is not uploaded to Vercel; environment changes require a new deployment to take effect.

`docs/AUTH.md` has operational detail but contains historical sections; check the conflict reference before using old schema instructions. `db:check` and `auth:check` contact the configured Supabase project; identify that target before running diagnostics. Never infer production success from local fixtures.
