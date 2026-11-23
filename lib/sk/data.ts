import type { SupabaseConfig } from "@/lib/content/config";
import type { ContentFetch } from "@/lib/content/supabase";
import { validateSKProfile, type PublishedSKProfile } from "./validation";

export async function readSKProfiles(
  config: SupabaseConfig,
  request: ContentFetch = fetch,
  slug?: string,
): Promise<PublishedSKProfile[] | null> {
  const result: PublishedSKProfile[] = [];
  for (let offset = 0; ; offset += 500) {
    const params = new URLSearchParams({
      select: "*,barangay:barangays!inner(id,name,slug,published)",
      published: "eq.true",
      "barangay.published": "eq.true",
      order: "sort_order.asc,slug.asc,id.asc",
      limit: "500",
      offset: String(offset),
    });
    if (slug) params.set("slug", `eq.${slug}`);
    const response = await request(
      `${config.url}/rest/v1/sk_profiles?${params}`,
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
      throw new Error("Unable to load SK information.");
    }
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error("Invalid SK information.");
    for (const row of rows) {
      if (
        !row ||
        typeof row.id !== "string" ||
        typeof row.updated_at !== "string" ||
        row.published !== true ||
        (slug && row.slug !== slug) ||
        !row.barangay ||
        row.barangay.id !== row.barangay_id ||
        row.barangay.published !== true ||
        typeof row.barangay.name !== "string" ||
        !row.barangay.name.trim() ||
        row.barangay.name.length > 160 ||
        typeof row.barangay.slug !== "string" ||
        row.barangay.slug.length > 180 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.barangay.slug)
      )
        throw new Error("Invalid SK information.");
      if (row.image_url != null) {
        const url = new URL(row.image_url);
        if (
          url.origin !== config.url ||
          !url.pathname.startsWith(
            "/storage/v1/object/public/municipal-media/sk/",
          ) ||
          url.search ||
          url.hash
        )
          throw new Error("Invalid SK image.");
      }
      result.push({
        id: row.id,
        updated_at: row.updated_at,
        image_url: row.image_url || null,
        ...validateSKProfile(row),
        barangay: {
          id: row.barangay.id,
          name: row.barangay.name,
          slug: row.barangay.slug,
        },
      });
    }
    if (rows.length < 500) return result;
  }
}
