import { validateBiography } from "@/lib/content/department-biography";
import { validateService } from "@/lib/content/service";
import { publicationPosition } from "./publication";
import {
  definitions,
  decodeRecord,
  type Collection,
} from "@/lib/content/schema";
export function collectionName(value: string): Collection | null {
  if (value === "department-page-and-head") return "departments";
  return Object.prototype.hasOwnProperty.call(definitions, value)
    ? (value as Collection)
    : null;
}
export function label(value: string) {
  if (value === "departments") return "Department Page";
  if (value === "contacts") return "Contacts";
  if (value === "hearings") return "Committee Hearings";
  const result = value.replace(/([A-Z])/g, " $1").replaceAll("_", " ");
  return result.charAt(0).toUpperCase() + result.slice(1);
}
export function parseContent(collection: Collection, form: FormData) {
  if (collection === "services") {
    const service = validateService(
      String(form.get("name") || ""),
      String(form.get("body") || ""),
    );
    form.set("name", service.name);
    form.set("body", service.body);
  }
  if (collection === "departments")
    validateBiography(String(form.get("head_description") || ""));
  const definition = definitions[collection];
  const row: Record<string, unknown> = {};
  for (const field of Object.values(definition.fields)) {
    if (
      ["officials", "contacts", "programs", "news", "services"].includes(
        collection,
      ) &&
      field.column === "id" &&
      !form.get("original")
    ) {
      row.id = "validation-only";
      continue;
    }
    const input = String(form.get(field.column) ?? "");
    const raw = (
      collection === "departments" && field.column === "head_description"
        ? validateBiography(input)
        : input
    ).trim();
    if (raw.length > 30000)
      throw new Error(`${label(field.column)} is too long.`);
    if (collection === "services" && field.column === "steps" && !raw)
      row.steps = [];
    else if (field.kind === "boolean") row[field.column] = raw === "on";
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
  if (
    ["officials", "contacts", "programs", "news", "services"].includes(
      collection,
    ) &&
    !form.get("original")
  )
    delete row.id;
  if (
    ["news", "programs"].includes(collection) &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(row.slug))
  )
    throw new Error(
      "Use lowercase letters, numbers, and single hyphens for the slug.",
    );
  row.published = form.get("published") === "on";
  row.sort_order = publicationPosition(form);
  return row;
}
