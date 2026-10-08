import "server-only";
import { createClient } from "@supabase/supabase-js";
import { authConfig } from "./config";
export function authAdminClient() {
  const config = authConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  let valid = key?.startsWith("sb_secret_") || false;
  if (key && !valid) {
    try {
      valid =
        JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
          .role === "service_role";
    } catch {}
  }
  if (!config || !key || !valid)
    throw new Error(
      "Server account management is not configured. Set SUPABASE_SERVICE_ROLE_KEY.",
    );
  return createClient(config.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
