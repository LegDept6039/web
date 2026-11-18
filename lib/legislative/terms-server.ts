import "server-only";
import { connection } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readContentConfig } from "@/lib/content/config";
import { type LegislativeTerm, selectedTerm } from "./terms";
export async function getTerms(
  client?: SupabaseClient,
): Promise<LegislativeTerm[]> {
  await connection();
  const result: LegislativeTerm[] = [];
  if (client) {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from("legislative_terms")
        .select("*")
        .order("start_date", { ascending: false })
        .range(offset, offset + 499);
      if (error)
        throw new Error(
          "Unable to load Legislative Terms. Apply migration 019.",
        );
      result.push(...(data || []));
      if (!data || data.length < 500) return result;
    }
  }
  const config = readContentConfig(process.env);
  if (config.source === "mock") return [];
  for (let offset = 0; ; offset += 500) {
    const response = await fetch(
      `${config.supabase.url}/rest/v1/legislative_terms?select=id,name,start_date,end_date&order=start_date.desc&limit=500&offset=${offset}`,
      {
        headers: { apikey: config.supabase.key },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new Error("Unable to load Legislative Terms. Apply migration 019.");
    const rows = (await response.json()) as LegislativeTerm[];
    result.push(...rows);
    if (rows.length < 500) return result;
  }
}
export async function publicTerm(requested?: string) {
  const terms = await getTerms();
  return { terms, selected: selectedTerm(terms, requested) };
}
