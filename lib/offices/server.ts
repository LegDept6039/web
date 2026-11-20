import "server-only";
import { branchAllows } from "./collections";
import type { Collection } from "@/lib/content/schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/server";
import {
  permits,
  type Office,
  type Access,
  type Operation,
} from "./permissions";
async function allRows(
  client: SupabaseClient,
  table: "departments" | "user_office_access",
  userId?: string,
) {
  const output: Record<string, unknown>[] = [];
  for (;;) {
    let query = client
      .from(table)
      .select("*", { count: "exact" })
      .order(table === "departments" ? "id" : "office_id")
      .range(output.length, output.length + 199);
    if (table === "departments") query = query.is("archived_at", null);
    if (userId) query = query.eq("user_id", userId);
    const { data, error, count } = await query;
    if (error)
      throw new Error(
        "Office configuration is unavailable. Apply the office-access migrations through 009.",
      );
    output.push(...(data || []));
    if (!data?.length || output.length >= (count ?? Infinity)) break;
  }
  return output;
}
export async function readOfficeAccess(
  client: SupabaseClient,
  userId: string,
): Promise<Access[]> {
  return (await allRows(
    client,
    "user_office_access",
    userId,
  )) as unknown as Access[];
}
export async function officeContext(writable = false) {
  const staff = await requireStaff(false, writable);
  const [offices, access] = await Promise.all([
    allRows(staff.client, "departments"),
    allRows(staff.client, "user_office_access", staff.user.id),
  ]);
  return {
    ...staff,
    offices: (offices as unknown as Office[])
      .filter(
        (o) =>
          !o.archived_at &&
          (staff.profile.role === "superadmin" ||
            access.some((a) => a.office_id === o.id)),
      )
      .sort(
        (a, b) =>
          a.department.localeCompare(b.department) ||
          a.name.localeCompare(b.name),
      ),
    access: access as unknown as Access[],
  };
}
export type OfficeContext = Awaited<ReturnType<typeof officeContext>>;
export function allowed(
  context: OfficeContext,
  officeId: string | null,
  operation: Operation,
) {
  if (context.profile.role === "superadmin") return true;
  const office = context.offices.find((o) => o.id === officeId && o.active);
  return (
    Boolean(office) &&
    permits(
      context.profile.role,
      context.access.find((a) => a.office_id === officeId)?.permission_level,
      operation,
    )
  );
}

export function contentAllowed(
  context: OfficeContext,
  collection: Collection,
  row: Record<string, unknown>,
  operation: Operation,
) {
  if (collection === "departments" && operation === "delete") return false;
  if (context.profile.role === "superadmin") return true;
  const office = context.offices.find(
    (o) => o.id === row.office_id && o.department === row.content_scope,
  );
  return Boolean(
    office &&
    branchAllows(office.department, collection) &&
    !(collection === "departments" && operation === "delete") &&
    allowed(
      context,
      office.id,
      operation === "delete" &&
        office.department === "executive" &&
        ["news", "programs", "services", "contacts"].includes(collection)
        ? "write"
        : operation,
    ),
  );
}
export function workflow(
  context: OfficeContext,
  officeId?: string,
): "legislative" | "executive" {
  const office = context.offices.find((o) => o.id === officeId);
  return (
    office?.department ||
    (context.offices.some((o) => o.active && o.department === "legislative") ||
    context.profile.role === "superadmin"
      ? "legislative"
      : "executive")
  );
}
export function available(
  context: OfficeContext,
  collection: Collection,
  officeId?: string,
  operation: Operation = "read",
) {
  if (context.profile.role === "superadmin") {
    if (!officeId) return true;
    const office = context.offices.find((o) => o.id === officeId && o.active);
    return Boolean(office && branchAllows(office.department, collection));
  }
  const branch = workflow(context, officeId);
  return context.offices.some(
    (o) =>
      o.department === branch &&
      branchAllows(branch, collection) &&
      (!officeId || o.id === officeId) &&
      allowed(context, o.id, operation),
  );
}
