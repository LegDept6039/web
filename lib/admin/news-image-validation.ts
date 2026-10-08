import sharp from "sharp";
export const NEWS_IMAGE_LIMIT = 10 * 1024 * 1024;
export function imagePart(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) || "department"
  );
}
export async function validateNewsImage(file: Blob) {
  if (!file.size || file.size > NEWS_IMAGE_LIMIT)
    throw new Error("Choose an image up to 10 MB.");
  if (!["image/jpeg", "image/png"].includes(file.type))
    throw new Error("Choose a JPG, JPEG, or PNG image.");
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(input, {
      limitInputPixels: 40000000,
    }).metadata();
    if (
      !["jpeg", "png"].includes(metadata.format || "") ||
      (metadata.pages || 1) > 1
    )
      throw new Error("format");
    const pipeline = sharp(input, { limitInputPixels: 40000000 }).rotate();
    const jpeg = metadata.format === "jpeg";
    const bytes = await (
      jpeg ? pipeline.jpeg({ quality: 90 }) : pipeline.png()
    ).toBuffer();
    if (bytes.length > NEWS_IMAGE_LIMIT) throw new Error("size");
    return {
      bytes,
      mime: jpeg ? "image/jpeg" : "image/png",
      extension: jpeg ? "jpg" : "png",
    };
  } catch {
    throw new Error(
      "Choose a valid, non-animated JPG or PNG image up to 10 MB (maximum 40 megapixels).",
    );
  }
}
