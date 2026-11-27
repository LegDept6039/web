import { validateBiography } from "@/lib/content/department-biography";
import { serviceExcerpt, validateService } from "@/lib/content/service";
import {
  richTextPlain,
  validateRichText,
  type RichNode,
} from "@/lib/content/rich-text";
import { publicationPosition } from "./publication";
import { departmentHeadPhotoVisibility } from "./department-photo-visibility";
import { normalizeContactNumber } from "@/lib/content/department-contact";
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
  let serviceDocument: RichNode | null = null;
  if (collection === "services") {
    if (form.has("rich_body")) {
      const raw = String(form.get("rich_body"));
      if (raw.length > 200000) throw new Error("Content is too long.");
      serviceDocument = validateRichText(JSON.parse(raw), true);
      // The validated document is authoritative; never trust a second submitted
      // body or summary that could disagree with its visible formatting.
      form.set("body", richTextPlain(serviceDocument));
    }
    const service = validateService(
      String(form.get("name") || ""),
      String(form.get("body") || ""),
    );
    form.set("name", service.name);
    form.set("body", service.body);
    form.set("description", serviceExcerpt(service.body));
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
  if (collection === "departments")
    row.show_head_photo_on_page = departmentHeadPhotoVisibility(form);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(row[definition.key])))
    throw new Error(
      "Use lowercase letters, numbers, and single hyphens for the ID or slug.",
    );
  // Plain-text submissions clear any previously stored formatting instead of
  // leaving a stale rich document attached to a changed body.
  if (collection === "services") row.rich_body = serviceDocument;
  if (collection === "contacts")
    row.value = normalizeContactNumber(String(row.type), String(row.value));
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
  row.published = collection === "sessions" || form.get("published") === "on";
  row.sort_order = collection === "sessions" ? 1 : publicationPosition(form);
  return row;
}
