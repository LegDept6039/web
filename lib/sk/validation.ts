import { barangaySlug } from "@/lib/barangays/validation";
import {
  richTextPlain,
  validateRichText,
  type RichNode,
} from "@/lib/content/rich-text";

export interface SKProfile {
  id: string;
  barangay_id: string;
  slug: string;
  chairperson_name: string;
  image_url: string | null;
  body: string;
  rich_body: RichNode | null;
  published: boolean;
  sort_order: number;
  updated_at: string;
}

export interface PublishedSKProfile extends SKProfile {
  barangay: { id: string; name: string; slug: string };
}

export function validateSKProfile(input: Record<string, unknown>) {
  const text = (key: string, label: string, max: number, required = true) => {
    const value = typeof input[key] === "string" ? input[key].trim() : "";
    if ((required && !value) || value.length > max)
      throw new Error(`Enter ${label} up to ${max} characters.`);
    return value;
  };
  const barangay_id = text("barangay_id", "a barangay", 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      barangay_id,
    )
  )
    throw new Error("Select a valid barangay.");
  const slug = text("slug", "a page address", 180);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error("Invalid SK page address.");
  const chairperson_name = text(
    "chairperson_name",
    "the SK chairperson's name",
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
    barangay_id,
    slug,
    chairperson_name,
    body,
    rich_body,
    sort_order,
    published: input.published === true || input.published === "on",
  };
}

/** The caller supplies a verified barangay name and the stored address on edits. */
export function prepareSKValues(
  input: Record<string, unknown>,
  barangayName: string,
  storedSlug?: string,
) {
  const generated =
    barangaySlug(barangayName).slice(0, 160).replace(/-+$/, "") || "sk";
  return validateSKProfile({ ...input, slug: storedSlug ?? generated });
}
