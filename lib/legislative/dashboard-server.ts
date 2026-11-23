import "server-only";
import { allowed, type OfficeContext } from "@/lib/offices/server";
import { loadLegislativeDashboard } from "./dashboard";

export async function getLegislativeDashboard(
  context: OfficeContext,
  officeId: string,
  selected: string,
) {
  const office = context.offices.find((item) => item.id === officeId);
  if (
    !office ||
    !office.active ||
    office.archived_at ||
    office.department !== "legislative" ||
    !allowed(context, office.id, "read")
  )
    throw new Error("No Legislative office access.");
  return loadLegislativeDashboard(context.client, office.id, selected);
}
