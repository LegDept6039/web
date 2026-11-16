import "server-only";
import { requireStaff } from "@/lib/auth/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { transparencyAccess } from "./permissions";
export async function requireTransparency(writable = false, manage = writable) {
  const staff = await requireStaff(false, writable);
  if (!transparencyAccess(staff.profile, manage)) redirect("/admin");
  return staff;
}
/** Fetch all visible rows without depending on the project's PostgREST row cap. */
export async function transparencyRows(
  client: SupabaseClient,
  table: "document_categories" | "municipal_documents",
) {
  const rows: Record<string, unknown>[] = [];
  for (let page = 0; page < 200; page++) {
    const offset = rows.length;
    const { data, error, count } = await client
      .from(table)
      .select("*", { count: "exact" })
      .eq("content_scope", "transparency")
      .is("deleted_at", null)
      .order("id")
      .range(offset, offset + 499);
    if (error)
      throw new Error(
        "Cannot load Transparency. Check migration 017 and your connection.",
      );
    rows.push(...data);
    if (!data.length || (count !== null && rows.length >= count)) return rows;
  }
  throw new Error(
    "Too many reports. Add pagination before expanding this dataset.",
  );
}
