// Read-only diagnostics. Never prints keys, passwords, or staff records.
import { createClient } from "@supabase/supabase-js";
const env = process.env;
const url = env.SUPABASE_URL?.trim();
const key = env.SUPABASE_PUBLISHABLE_KEY?.trim();
if (!url || !key?.startsWith("sb_publishable_")) {
  console.error("Missing SUPABASE_URL or valid SUPABASE_PUBLISHABLE_KEY.");
  process.exitCode = 1;
} else {
  console.log("Public Supabase configuration: present.");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(10000),
    });
    console.log(`Auth service: HTTP ${response.status}`);
    if (!response.ok) process.exitCode = 1;
  } catch {
    console.error("Auth service connection failed.");
    process.exitCode = 1;
  }
  const secret = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    console.log(
      "Server administration key: missing. Login can work, but account creation and admin password resets cannot.",
    );
  } else {
    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    console.log(
      `Auth admin API: ${error ? "unavailable; check key/project pairing" : "OK"}`,
    );
    if (error) process.exitCode = 1;
    for (const table of [
      "staff_accounts",
      "departments",
      "user_office_access",
      "audit_logs",
    ]) {
      const { error } = await admin
        .from(table)
        .select(
          table === "staff_accounts" || table === "user_office_access"
            ? "user_id"
            : table === "departments"
              ? "id,archived_at"
              : "id",
        )
        .limit(1);
      console.log(`${table}: ${error ? "unavailable; check migration" : "OK"}`);
      if (error) process.exitCode = 1;
    }
  }
  // Anonymous clients must not be able to read staff identities.
  const { error } = await client
    .from("staff_accounts")
    .select("user_id")
    .limit(1);
  console.log(
    `Anonymous staff table access: ${error ? "denied (expected)" : "WARNING: unexpectedly allowed"}`,
  );
  if (!error) process.exitCode = 1;
}
for (const name of Object.keys(env))
  if (
    name.startsWith("NEXT_PUBLIC_") &&
    /SERVICE_ROLE|SECRET_KEY/.test(name) &&
    env[name]
  ) {
    console.error(
      "Remove frontend-exposed privileged key variables and rotate any exposed key.",
    );
    process.exitCode = 1;
  }
