import type { Office } from "@/lib/offices/permissions";

/** Identity of the canonical access workspace; activity is checked separately. */
export function isBarangayAffairsOffice(
  office: Pick<Office, "slug" | "department"> | null | undefined,
) {
  return (
    office?.slug === "barangay-affairs" && office.department === "executive"
  );
}
