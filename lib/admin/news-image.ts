import "server-only";
import { validateNewsImage, imagePart } from "./news-image-validation";
export { NEWS_IMAGE_LIMIT } from "./news-image-validation";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function uploadNewsImage(
  client: SupabaseClient,
  userId: string,
  department: { id: string; slug: string; short_name: string },
  recordId: string,
  slug: string,
  stagedPath: string,
  collection: "news" | "programs" = "news",
) {
  const prefix = `${collection}/${department.id}/${userId}/`;
  if (
    !stagedPath.startsWith(prefix) ||
    !/^[0-9a-f-]{36}\.(jpg|png)$/.test(stagedPath.slice(prefix.length))
  )
    throw new Error("Invalid upload reference. Select the image again.");
  const staging = client.storage.from("municipal-news-staging");
  const { data, error } = await staging.download(stagedPath);
  if (error || !data)
    throw new Error("Image upload is unavailable. Select it again and retry.");
  try {
    const { bytes, mime, extension } = await validateNewsImage(data);
    // Immutable version directory prevents collisions/cached replacements; basename carries the real record ID.
    const path = `${prefix}${crypto.randomUUID()}/${imagePart(department.short_name || department.slug)}_${collection}_${imagePart(slug)}_${recordId}.${extension}`;
    const { error: uploadError } = await client.storage
      .from("municipal-media")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (uploadError)
      throw new Error(
        "Image could not be saved. Check migration 039 and Storage access.",
      );
    return {
      path,
      mime,
      size: bytes.length,
      url: client.storage.from("municipal-media").getPublicUrl(path).data
        .publicUrl,
    };
  } finally {
    await staging.remove([stagedPath]);
  }
}
