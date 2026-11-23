import "server-only";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
export const PHOTO_LIMIT = 10 * 1024 * 1024;
export async function uploadOfficialPhoto(
  client: SupabaseClient,
  userId: string,
  file: File,
  folder: "officials" | "departments" | "barangays" | "sk" = "officials",
) {
  if (file.size > PHOTO_LIMIT) throw new Error("Choose an image up to 10 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  let bytes: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(input, {
      limitInputPixels: 25000000,
    }).metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format || "") ||
      (metadata.pages || 1) > 1 ||
      !metadata.width ||
      !metadata.height
    )
      throw new Error("type");
    const square = folder === "barangays" || folder === "sk";
    const edge = square
      ? Math.min(1200, metadata.width, metadata.height)
      : 1200;
    bytes = await sharp(input, { limitInputPixels: 25000000 })
      .rotate()
      .resize({
        width: edge,
        height: edge,
        fit: square ? "cover" : "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new Error(
      "This image cannot be read. Choose a valid, non-animated JPEG, PNG, or WebP image.",
    );
  }
  const path = `${folder}/${userId}/${crypto.randomUUID()}.webp`;
  const { error } = await client.storage
    .from("municipal-media")
    .upload(path, bytes, { contentType: "image/webp", upsert: false });
  if (error)
    throw new Error(
      "Photo upload failed. Check your connection and the profile-photo Storage policy, then retry.",
    );
  return {
    path,
    url: client.storage.from("municipal-media").getPublicUrl(path).data
      .publicUrl,
  };
}
