import type { SupabaseConfig } from "@/lib/content/config";
import type { ContentFetch } from "@/lib/content/supabase";
import { validateBarangay, type Barangay } from "./validation";

export async function readBarangays(
  config: SupabaseConfig,
  request: ContentFetch = fetch,
  slug?: string,
): Promise<Barangay[] | null> {
  const result: Barangay[] = [];
  for (let offset = 0; ; offset += 500) {
    const params = new URLSearchParams({
      select: "*",
      published: "eq.true",
      order: "sort_order.asc,name.asc,id.asc",
      limit: "500",
      offset: String(offset),
    });
    if (slug) params.set("slug", `eq.${slug}`);
    const response = await request(
      `${config.url}/rest/v1/barangays?${params}`,
      {
        headers: { apikey: config.key, Accept: "application/json" },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      if (["42P01", "PGRST205"].includes(error?.code)) return null;
      throw new Error("Unable to load barangay information.");
    }
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error("Invalid barangay information.");
    for (const row of rows) {
      if (
        !row ||
        typeof row.id !== "string" ||
        typeof row.updated_at !== "string" ||
        row.published !== true ||
        (slug && row.slug !== slug)
      )
        throw new Error("Invalid barangay information.");
      if (row.image_url != null) {
        const url = new URL(row.image_url);
        if (
          url.origin !== config.url ||
          !url.pathname.startsWith(
            "/storage/v1/object/public/municipal-media/barangays/",
          ) ||
          url.search ||
          url.hash
        )
          throw new Error("Invalid barangay image.");
      }
      result.push({
        id: row.id,
        updated_at: row.updated_at,
        image_url: row.image_url || null,
        ...validateBarangay(row),
      });
    }
    if (rows.length < 500) return result;
  }
}
