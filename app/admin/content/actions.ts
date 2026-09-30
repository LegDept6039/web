"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/server";
import { collectionName, parseContent } from "@/lib/admin/content";
import { definitions } from "@/lib/content/schema";

export async function saveContent(
  _state: string,
  form: FormData,
): Promise<string> {
  const { client } = await requireStaff(true, true);
  const collection = collectionName(String(form.get("collection")));
  if (!collection) return "Unknown content collection.";
  const definition = definitions[collection];
  let row: Record<string, unknown>;
  try {
    row = parseContent(collection, form);
  } catch (error) {
    return error instanceof Error ? error.message : "Check the form fields.";
  }
  // These images are rendered by next/image, whose remote source is restricted.
  for (const column of ["image", "photo_url"]) {
    const value = row[column];
    if (typeof value === "string" && !value.startsWith("/")) {
      const url = new URL(value);
      if (
        url.origin !== process.env.SUPABASE_URL?.replace(/\/$/, "") ||
        !url.pathname.startsWith(
          "/storage/v1/object/public/municipal-media/",
        ) ||
        url.search
      )
        return "Use a local image path or an image from the municipal-media bucket.";
    }
  }
  const original = String(form.get("original") || "");
  if (original && original !== row[definition.key])
    return "An existing record ID cannot be changed.";
  const result = original
    ? await client
        .from(definition.table)
        .update(row)
        .eq(definition.key, original)
        .eq("updated_at", String(form.get("updated_at")))
        .select(definition.key)
    : await client.from(definition.table).insert(row).select(definition.key);
  if (result.error)
    return result.error.code === "23505"
      ? "That ID already exists. Choose a different ID."
      : result.error.code === "23503"
        ? "Choose an existing related record (for example, a document category)."
        : "Could not save. Check the fields and your access, then try again.";
  if (!result.data?.length)
    return "This record changed or your access was removed. Reload before saving.";
  revalidatePath("/", "layout");
  redirect(`/admin/content/${collection}`);
}

export async function deleteContent(
  _state: string,
  form: FormData,
): Promise<string> {
  const { client } = await requireStaff(true, true);
  const collection = collectionName(String(form.get("collection")));
  if (!collection || form.get("confirm") !== "on")
    return "Confirm deletion first.";
  const definition = definitions[collection];
  const { data, error } = await client
    .from(definition.table)
    .delete()
    .eq(definition.key, String(form.get("original")))
    .eq("updated_at", String(form.get("updated_at")))
    .select(definition.key);
  if (error)
    return "Could not delete. Remove related records first and check your access.";
  if (!data?.length)
    return "This record changed or no longer exists. Reload the page.";
  revalidatePath("/", "layout");
  redirect(`/admin/content/${collection}`);
}
