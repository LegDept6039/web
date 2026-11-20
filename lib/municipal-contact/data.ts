import type { SupabaseConfig } from "@/lib/content/config";
import type { ContentFetch } from "@/lib/content/supabase";
import {
  validateContactSettings,
  type MunicipalContactSettings,
} from "./validation";

export async function readMunicipalContact(
  config: SupabaseConfig,
  request: ContentFetch = fetch,
): Promise<MunicipalContactSettings | null> {
  const params = new URLSearchParams({
    select: "*",
    id: "eq.municipal",
    limit: "1",
  });
  const response = await request(
    `${config.url}/rest/v1/municipal_contact_settings?${params}`,
    {
      headers: { apikey: config.key, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    // Allow the department directory to remain available during an upgrade.
    if (["42P01", "PGRST205"].includes(error?.code)) return null;
    throw new Error("Unable to load municipal contact information.");
  }
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length > 1)
    throw new Error("Invalid municipal contact information.");
  if (!rows.length) return null;
  const row = rows[0];
  if (!row || row.id !== "municipal" || typeof row.updated_at !== "string")
    throw new Error("Invalid municipal contact information.");
  return {
    id: "municipal",
    ...validateContactSettings(row),
    updated_at: row.updated_at,
  };
}
