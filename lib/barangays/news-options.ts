import "server-only";
import { allowed, type OfficeContext } from "@/lib/offices/server";
import { isBarangayAffairsOffice } from "./permissions";
import type { BarangayNewsOption } from "./news";

/** Load choices with the staff session, including unpublished profiles. */
export async function barangayNewsOptions(
  context: OfficeContext,
): Promise<BarangayNewsOption[]> {
  if (
    !context.offices.some(
      (office) =>
        office.active &&
        !office.archived_at &&
        isBarangayAffairsOffice(office) &&
        allowed(context, office.id, "read"),
    )
  )
    return [];
  const options: BarangayNewsOption[] = [];
  for (;;) {
    const { data, error, count } = await context.client
      .from("barangays")
      .select("id,name,published", { count: "exact" })
      .order("name")
      .order("id")
      .range(options.length, options.length + 499);
    if (error || count === null)
      throw new Error(
        "Unable to load barangays for news. Apply migration 032.",
      );
    if (!data?.length && options.length < count)
      throw new Error("Unable to load all barangays for news.");
    options.push(...(data || []));
    if (options.length >= count) return options;
  }
}
