import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { readContentConfig } from "@/lib/content/config";
import { readMockCollection } from "@/lib/content/mock";
import { getCollection } from "@/lib/content/repository";
import {
  readMockResolutionArchive,
  readResolutionArchive,
  type ResolutionArchiveInput,
} from "./resolution-archive";

export async function getResolutionArchive(input: ResolutionArchiveInput) {
  const config = readContentConfig(process.env);
  if (config.source === "mock")
    return readMockResolutionArchive(input, readMockCollection("resolutions"));
  await connection();
  return readResolutionArchive(input, config.supabase);
}

/** Request-local deduplication only; public edits are read again on every request. */
export const getResolution = cache(async (id: string) => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(id)) return undefined;
  return (await getCollection("resolutions", { id }, 1)).find(
    (document) => document.id === id && document.contentScope !== "executive",
  );
});
