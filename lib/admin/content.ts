import {
  definitions,
  decodeRecord,
  type Collection,
} from "@/lib/content/schema";
export function collectionName(value: string): Collection | null {
  return Object.prototype.hasOwnProperty.call(definitions, value)
    ? (value as Collection)
    : null;
}
export function label(value: string) {
  const result = value.replace(/([A-Z])/g, " $1").replaceAll("_", " ");
  return result.charAt(0).toUpperCase() + result.slice(1);
}
export function parseContent(collection: Collection, form: FormData) {
  const definition = definitions[collection];
  const row: Record<string, unknown> = {};
  for (const field of Object.values(definition.fields)) {
    const raw = String(form.get(field.column) ?? "").trim();
    if (raw.length > 30000)
      throw new Error(`${label(field.column)} is too long.`);
    if (field.kind === "boolean") row[field.column] = raw === "on";
    else if (field.optional && !raw) row[field.column] = null;
    else {
      if (!raw) throw new Error(`${label(field.column)} is required.`);
      row[field.column] =
        field.kind === "integer"
          ? Number(raw)
          : field.kind === "list"
            ? raw
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean)
            : raw;
    }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(row[definition.key])))
    throw new Error(
      "Use lowercase letters, numbers, and single hyphens for the ID or slug.",
    );
  decodeRecord(collection, row);
  row.published = form.get("published") === "on";
  row.sort_order = Number(form.get("sort_order") || 0);
  if (
    !Number.isSafeInteger(row.sort_order) ||
    Math.abs(Number(row.sort_order)) > 2147483647
  )
    throw new Error("Sort order must be a valid integer.");
  return row;
}
