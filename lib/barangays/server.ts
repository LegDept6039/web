import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { readContentConfig } from "@/lib/content/config";
import { readBarangays } from "./data";

export const getBarangays = cache(async (slug?: string) => {
  const config = readContentConfig(process.env);
  if (config.source === "mock") return [];
  await connection();
  return readBarangays(config.supabase, fetch, slug);
});
