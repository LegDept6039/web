import "server-only";
import { notFound } from "next/navigation";
import {
  allowed,
  officeContext,
  type OfficeContext,
} from "@/lib/offices/server";
import type { Operation } from "@/lib/offices/permissions";
import { isBarangayAffairsOffice } from "./permissions";

export function barangayAffairsAllowed(
  context: OfficeContext,
  operation: Operation = "read",
) {
  if (operation === "delete") return false;
  if (context.profile.role === "superadmin") return true;
  const office = context.offices.find(
    (item) => isBarangayAffairsOffice(item) && item.active && !item.archived_at,
  );
  return Boolean(office && allowed(context, office.id, operation));
}

export async function requireBarangayAffairs(writable = false) {
  const context = await officeContext(writable);
  if (!barangayAffairsAllowed(context, writable ? "write" : "read")) notFound();
  return context;
}
