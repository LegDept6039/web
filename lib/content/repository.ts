import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { readContentConfig } from "./config";
import { readMockCollection } from "./mock";
import { readSupabaseCollection } from "./supabase";
import type { Collection, Collections } from "./schema";
/** Presentation depends on these domain types, never on Supabase's row format. */
async function load<K extends Collection>(
  collection: K,
): Promise<Collections[K][]> {
  const config = readContentConfig(process.env);
  if (config.source === "mock") return readMockCollection(collection);
  // Never fetch the database during a build. Published edits appear on the next request.
  await connection();
  return readSupabaseCollection(collection, config.supabase);
}
export const getCollection = cache(load);
