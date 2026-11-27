import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gallerySelection } from "@/lib/content/gallery";
import { uploadNewsImage } from "./news-image";

export async function prepareGalleryImages(
  client: SupabaseClient,
  userId: string,
  department: { id: string; slug: string; short_name: string },
  collection: "news" | "programs",
  recordId: string,
  slug: string,
  form: FormData,
  existing: unknown,
) {
  const { retained, staged } = gallerySelection(form, existing);
  const uploadedPaths: string[] = [];
  const urls = [...retained];
  try {
    for (const path of staged) {
      const photo = await uploadNewsImage(
        client,
        userId,
        department,
        recordId,
        slug,
        path,
        collection,
      );
      uploadedPaths.push(photo.path);
      urls.push(photo.url);
    }
    return { urls, uploadedPaths };
  } catch (error) {
    if (uploadedPaths.length)
      await client.storage.from("municipal-media").remove(uploadedPaths);
    throw error;
  }
}
