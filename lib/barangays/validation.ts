import {
  richTextPlain,
  validateRichText,
  type RichNode,
} from "@/lib/content/rich-text";

export interface Barangay {
  id: string;
  name: string;
  slug: string;
  captain_name: string;
  image_url: string | null;
  body: string;
  rich_body: RichNode | null;
  published: boolean;
  sort_order: number;
  updated_at: string;
}

export function barangaySlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateBarangay(input: Record<string, unknown>) {
  const text = (key: string, label: string, max: number, required = true) => {
    const value = typeof input[key] === "string" ? input[key].trim() : "";
    if ((required && !value) || value.length > max)
      throw new Error(`Enter ${label} up to ${max} characters.`);
    return value;
  };
  const name = text("name", "a barangay name", 160);
  const slug = text("slug", "a URL name", 180);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error(
      "The URL name must use lowercase letters, numbers and single hyphens.",
    );
  const captain_name = text(
    "captain_name",
    "the barangay captain's name",
    200,
    false,
  );
  let rich_body: RichNode | null = null;
  if (input.rich_body != null && input.rich_body !== "") {
    if (typeof input.rich_body === "string" && input.rich_body.length > 200000)
      throw new Error("Content is too long.");
    rich_body = validateRichText(
      typeof input.rich_body === "string"
        ? JSON.parse(input.rich_body)
        : input.rich_body,
      false,
    );
  }
  const body = rich_body
    ? richTextPlain(rich_body).trim()
    : text("body", "body content", 30000, false);
  const sort_order = Number(input.sort_order ?? 0);
  if (
    !Number.isSafeInteger(sort_order) ||
    sort_order < 0 ||
    sort_order > 2147483647
  )
    throw new Error("Enter a display order of 0 or greater.");
  return {
    name,
    slug,
    captain_name,
    body,
    rich_body,
    sort_order,
    published: input.published === true || input.published === "on",
  };
}

/** Page addresses are server-owned; form fields never choose or replace them. */
export function prepareBarangayValues(
  input: Record<string, unknown>,
  storedSlug?: string,
) {
  const name = typeof input.name === "string" ? input.name : "";
  const generated =
    barangaySlug(name).slice(0, 160).replace(/-+$/, "") || "barangay";
  return validateBarangay({ ...input, slug: storedSlug ?? generated });
}

export function barangayExcerpt(body: string) {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}...` : text;
}
