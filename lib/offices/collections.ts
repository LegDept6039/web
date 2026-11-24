import type { Collection } from "@/lib/content/schema";
import type { Office } from "./permissions";
import { isBarangayAffairsOffice } from "@/lib/barangays/permissions";
/** Branch collection availability, not configurable per-user module permissions. */
export function branchAllows(branch: string, collection: Collection) {
  return (
    branch === "legislative" ||
    (branch === "executive" &&
      ["departments", "news", "programs", "services", "contacts"].includes(
        collection,
      ))
  );
}

export function officeAllowsCollection(office: Office, collection: Collection) {
  return isBarangayAffairsOffice(office)
    ? collection === "news"
    : branchAllows(office.department, collection);
}
