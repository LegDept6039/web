export const reportSlots = ["annual", "q1", "q2", "q3", "q4"] as const;
export type ReportSlot = (typeof reportSlots)[number];
export function slotsFor(frequency: string): readonly ReportSlot[] {
  return frequency === "quarterly" ? reportSlots.slice(1) : ["annual"];
}
export function slotLabel(slot: string) {
  return slot === "annual" ? "Annual PDF" : slot.toUpperCase();
}
export function isReportSlot(value: string): value is ReportSlot {
  return reportSlots.some((s) => s === value);
}
export function reportYears(current: number, existing?: number) {
  return [
    ...new Set([
      ...(existing ? [existing] : []),
      ...Array.from({ length: current - 1900 + 2 }, (_, i) => current + 1 - i),
    ]),
  ].sort((a, b) => b - a);
}
