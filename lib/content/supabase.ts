import {
  decodeRecord,
  definitions,
  type Collection,
  type Collections,
} from "./schema";
import type { SupabaseConfig } from "./config";
export type ContentFilters = Partial<
  Record<
    "slug" | "id" | "office_id" | "branch" | "content_scope" | "role",
    string
  >
>;
export type ContentFetch = (
  url: string,
  init: RequestInit,
) => Promise<Response>;
/** Reads the Supabase PostgREST API; no SDK, database connection, or write credentials. */
export async function readSupabaseCollection<K extends Collection>(
  collection: K,
  config: SupabaseConfig,
  request: ContentFetch = fetch,
  filters: ContentFilters = {},
  limit?: number,
): Promise<Collections[K][]> {
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1))
    throw new Error("Invalid content limit.");
  const definition = definitions[collection];
  const results: Collections[K][] = [];
  const columns = Object.values(definition.fields)
    .map((f) => f.column)
    .join(",");
  for (let page = 0; page < 200; page++) {
    const params = new URLSearchParams({
      select:
        columns +
        (["news", "programs"].includes(collection) ? ",source,rich_body" : ""),
      published: "eq.true",
      order: `sort_order.asc,${definition.key}.asc`,
      limit: String(
        Math.min(500, limit === undefined ? 500 : limit - results.length),
      ),
      offset: String(results.length),
    });
    if (collection === "officials" && filters.branch === "legislative")
      params.set("legislative_role", "not.is.null");
    if (collection === "departments") {
      params.set("active", "eq.true");
      params.set("archived_at", "is.null");
      params.set("department", "eq.executive");
    }
    for (const [key, value] of Object.entries(filters))
      params.set(key, `eq.${value}`);
    let response: Response;
    try {
      response = await request(
        `${config.url}/rest/v1/${["news", "programs"].includes(collection) ? `published_${collection}` : definition.table}?${params}`,
        {
          headers: {
            apikey: config.key,
            Accept: "application/json",
            Prefer: "count=exact",
          },
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      throw new Error(
        `Could not reach the content database for ${collection}. Check connectivity and Supabase configuration.`,
      );
    }
    if (!response.ok)
      throw new Error(
        `Could not load ${collection} (HTTP ${response.status}). Check the schema, publishable key, and read policies.`,
      );
    const rows: unknown = await response.json();
    if (!Array.isArray(rows))
      throw new Error(`Invalid database response for ${collection}.`);
    const range = response.headers.get("content-range");
    const totalPart = range?.split("/")[1];
    const total =
      totalPart && /^\d+$/.test(totalPart) ? Number(totalPart) : undefined;
    if (rows.length === 0) {
      if (total !== undefined && results.length < total)
        throw new Error(`Incomplete database response for ${collection}.`);
      return results;
    }
    results.push(...rows.map((row) => decodeRecord(collection, row)));
    if (limit !== undefined && results.length >= limit)
      return results.slice(0, limit);
    if (total !== undefined && results.length >= total) return results;
    // Continue even if the server's configured row limit is below our requested page size.
  }
  throw new Error(
    `Too many ${collection} records for this directory. Add server-side pagination before expanding this dataset.`,
  );
}
