import {
  decodeRecord,
  definitions,
  type Collection,
  type Collections,
} from "./schema";
import type { SupabaseConfig } from "./config";
export type ContentFetch = (
  url: string,
  init: RequestInit,
) => Promise<Response>;
/** Reads the Supabase PostgREST API; no SDK, database connection, or write credentials. */
export async function readSupabaseCollection<K extends Collection>(
  collection: K,
  config: SupabaseConfig,
  request: ContentFetch = fetch,
): Promise<Collections[K][]> {
  const definition = definitions[collection];
  const results: Collections[K][] = [];
  const columns = Object.values(definition.fields)
    .map((f) => f.column)
    .join(",");
  for (let page = 0; page < 200; page++) {
    const params = new URLSearchParams({
      select: columns,
      published: "eq.true",
      order: `sort_order.asc,${definition.key}.asc`,
      limit: "500",
      offset: String(results.length),
    });
    let response: Response;
    try {
      response = await request(
        `${config.url}/rest/v1/${definition.table}?${params}`,
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
    if (total !== undefined && results.length >= total) return results;
    // Continue even if the server's configured row limit is below our requested page size.
  }
  throw new Error(
    `Too many ${collection} records for this directory. Add server-side pagination before expanding this dataset.`,
  );
}
