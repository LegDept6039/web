export interface SupabaseConfig {
  url: string;
  key: string;
}
export type ContentConfig =
  { source: "mock" } | { source: "supabase"; supabase: SupabaseConfig };
export function readContentConfig(
  env: Record<string, string | undefined>,
): ContentConfig {
  const source = env.CONTENT_SOURCE ?? "mock";
  if (source === "mock") return { source };
  if (source !== "supabase")
    throw new Error("CONTENT_SOURCE must be mock or supabase.");
  const key = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const rawUrl = env.SUPABASE_URL?.trim();
  if (!rawUrl || !key)
    throw new Error(
      "Supabase mode requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. See docs/SUPABASE.md.",
    );
  if (!key.startsWith("sb_publishable_"))
    throw new Error(
      "Use a Supabase publishable key (sb_publishable_), not a secret, service-role key, or database password.",
    );
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("SUPABASE_URL must be a valid HTTPS project URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  )
    throw new Error(
      "SUPABASE_URL must be an HTTPS project origin without a path or credentials.",
    );
  return { source, supabase: { url: url.origin, key } };
}
