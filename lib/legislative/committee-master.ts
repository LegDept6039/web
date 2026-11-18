import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export interface MasterCommittee {
  id: string;
  name: string;
  sort_order: number;
  updated_at: string;
}
export async function getCommitteeMasters(
  client: SupabaseClient,
): Promise<MasterCommittee[]> {
  const rows: MasterCommittee[] = [];
  for (;;) {
    const { data, error, count } = await client
      .from("committee_master")
      .select("id,name,sort_order,updated_at", { count: "exact" })
      .order("sort_order")
      .order("id")
      .range(rows.length, rows.length + 499);
    if (error)
      throw new Error(
        "Unable to load Master Committees. Apply migration 020 and check your access.",
      );
    rows.push(...(data || []));
    if (!data?.length || rows.length >= (count ?? Infinity)) return rows;
  }
}
