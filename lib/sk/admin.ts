import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SKBarangayOption {
  id: string;
  name: string;
  published: boolean;
}

/** Call only after the active Superadmin guard. Include drafts for draft SK profiles. */
export async function loadSKBarangays(client: SupabaseClient) {
  const options: SKBarangayOption[] = [];
  for (let offset = 0; ;) {
    const { data, error, count } = await client
      .from("barangays")
      .select("id,name,published", { count: "exact" })
      .order("name")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error("Unable to load barangays.");
    if (!data?.length) return options;
    options.push(...(data as SKBarangayOption[]));
    offset += data.length;
    if (count !== null && offset >= count) return options;
  }
}
