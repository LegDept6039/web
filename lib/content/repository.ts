import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { readContentConfig } from "./config";
import { readMockCollection } from "./mock";
import { readSupabaseCollection, type ContentFilters } from "./supabase";
import type { Collection, Collections } from "./schema";
/** Presentation depends on these domain types, never on Supabase's row format. */
async function load<K extends Collection>(
  collection: K,
  filters: ContentFilters = {},
  limit?: number,
): Promise<Collections[K][]> {
  const config = readContentConfig(process.env);
  if (config.source === "mock") {
    const names: Record<string, string> = {
      office_id: "officeId",
      content_scope: "contentScope",
    };
    const rows = readMockCollection(collection).filter((row) =>
      Object.entries(filters).every(
        ([key, value]) =>
          (row as unknown as Record<string, unknown>)[names[key] || key] ===
          value,
      ),
    );
    return limit === undefined ? rows : rows.slice(0, limit);
  }
  // Never fetch the database during a build. Published edits appear on the next request.
  await connection();
  return readSupabaseCollection(
    collection,
    config.supabase,
    fetch,
    filters,
    limit,
  );
}
export const getCollection = cache(load);
