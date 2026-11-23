import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { readContentConfig } from "@/lib/content/config";
import { readSKProfiles } from "./data";

export const getSKProfiles = cache(async (slug?: string) => {
  const config = readContentConfig(process.env);
  if (config.source === "mock") return [];
  await connection();
  return readSKProfiles(config.supabase, fetch, slug);
});
