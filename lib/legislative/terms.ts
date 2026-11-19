export interface LegislativeTerm {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  updated_at?: string;
}
export function philippineDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function termForDate(terms: LegislativeTerm[], date: string) {
  return terms.find((t) => date >= t.start_date && date <= t.end_date);
}
export function termStatus(term: LegislativeTerm, today = philippineDate()) {
  return today < term.start_date
    ? "Upcoming"
    : today > term.end_date
      ? "Previous"
      : "Current";
}
export function termDisplayName(term: LegislativeTerm, today = philippineDate()) {
  const startYear = term.start_date.slice(0, 4);
  const endYear =
    termStatus(term, today) === "Current"
      ? "Current"
      : term.end_date.slice(0, 4);
  return `${term.name} ${startYear}-${endYear}`;
}
export function selectedTerm(
  terms: LegislativeTerm[],
  requested?: string,
  today = philippineDate(),
) {
  if (requested === "unassigned") return "unassigned";
  if (requested)
    return terms.some((t) => t.id === requested) ? requested : "none";
  return termForDate(terms, today)?.id || "none";
}
export function inTerm(record: { termId?: string }, selected: string) {
  return selected === "unassigned"
    ? !record.termId
    : record.termId === selected;
}
export function validateTerm(name: string, start: string, end: string) {
  const valid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!name.trim() || name.trim().length > 150)
    throw new Error("Enter a term name of up to 150 characters.");
  if (!valid(start) || !valid(end) || start > end)
    throw new Error("Enter valid dates with the end on or after the start.");
}
