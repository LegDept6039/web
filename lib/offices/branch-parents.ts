import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isBarangayAffairsOffice } from "@/lib/barangays/permissions";
import type { Office } from "./permissions";

export type DepartmentParent = Pick<Office, "id" | "name" | "active">;

/** Identity management only; branch membership continues to be explicit. */
export async function departmentParentOptions(
  client: SupabaseClient,
  currentId?: string,
  existingParentId?: string | null,
): Promise<DepartmentParent[]> {
  const output: DepartmentParent[] = [];
  for (let offset = 0; ;) {
    const { data, error, count } = await client
      .from("departments")
      .select(
        "id,name,active,slug,department,parent_department_id,archived_at",
        {
          count: "exact",
        },
      )
      .eq("department", "executive")
      .is("parent_department_id", null)
      .order("name")
      .order("id")
      .range(offset, offset + 199);
    if (error)
      throw new Error(
        "Unable to load parent departments. Apply migration 034 before managing branches.",
      );
    for (const row of data || []) {
      if (
        row.id !== currentId &&
        !isBarangayAffairsOffice(row) &&
        (!row.archived_at || row.id === existingParentId)
      )
        output.push({
          id: row.id,
          name: row.name,
          active: row.active && !row.archived_at,
        });
    }
    if (!data?.length || offset + data.length >= (count ?? Infinity)) break;
    offset += data.length;
  }
  return output;
}
