"use server";
import { officeContext, available } from "@/lib/offices/server";
import { definitions, type Collection } from "@/lib/content/schema";
export async function positionLimit(
  collection: Collection,
  office: string,
  branch: string,
  original: string,
): Promise<{ max?: number; error?: string }> {
  const context = await officeContext();
  if (!Object.hasOwn(definitions, collection))
    return { error: "Unknown collection." };
  if (collection === "departments" && context.profile.role !== "superadmin")
    return { error: "Department sorting requires Superadmin." };
  if (!available(context, collection, office || undefined))
    return { error: "No access to this collection." };
  let query = context.client
    .from(definitions[collection].table)
    .select("id", { count: "exact", head: true })
    .eq("published", true);
  if (collection === "departments") query = query.eq("department", branch);
  else {
    query = query.eq("content_scope", branch);
    query = office
      ? query.eq("office_id", office)
      : query.is("office_id", null);
  }
  if (original) query = query.neq("id", original);
  const { count, error } = await query;
  return error
    ? { error: "Unable to load positions. Retry or reload." }
    : { max: (count || 0) + 1 };
}
