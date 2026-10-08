export const legislativeRoles = {
  SANGGUNIANG_BAYAN: "Sangguniang Bayan",
  SECRETARY_TO_THE_SANGGUNIANG_BAYAN: "Secretary to the Sangguniang Bayan",
  MUNICIPAL_VICE_MAYOR: "Municipal Vice-Mayor",
} as const;
export type LegislativeRole = keyof typeof legislativeRoles;
export function isLegislativeRole(value: unknown): value is LegislativeRole {
  return typeof value === "string" && Object.hasOwn(legislativeRoles, value);
}
