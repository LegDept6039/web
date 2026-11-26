export const documentApprovalModes = ["authored", "mass_motion"] as const;
export type DocumentApprovalMode = (typeof documentApprovalModes)[number];

/** Missing values keep existing imports and historical authored records compatible. */
export function documentApprovalMode(value: unknown): DocumentApprovalMode {
  if (value === undefined || value === null || value === "") return "authored";
  if (value === "authored" || value === "mass_motion") return value;
  throw new Error(
    "Choose Individual author or Mass motion as the approval method.",
  );
}
