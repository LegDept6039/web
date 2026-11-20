import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { readContentConfig } from "@/lib/content/config";
import { defaultMunicipalContact } from "./defaults";
import { readMunicipalContact } from "./data";

export const getMunicipalContact = cache(async () => {
  const config = readContentConfig(process.env);
  if (config.source === "mock") return defaultMunicipalContact;
  await connection();
  return readMunicipalContact(config.supabase);
});
