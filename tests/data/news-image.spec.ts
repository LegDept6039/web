import { test, expect } from "@playwright/test";
import sharp from "sharp";
import {
  validateNewsImage,
  NEWS_IMAGE_LIMIT,
  imagePart,
} from "../../lib/admin/news-image-validation";
import { parseContent, collectionName } from "../../lib/admin/content";
test("news validates actual bytes, format, file size and safe filename parts", async () => {
  for (const format of ["jpeg", "png"] as const) {
    const bytes = await sharp({
      create: { width: 12, height: 12, channels: 3, background: "red" },
    })
      [format]()
      .toBuffer();
    const file = new Blob([new Uint8Array(bytes)], { type: `image/${format}` });
    const result = await validateNewsImage(file);
    expect(result.extension).toBe(format === "jpeg" ? "jpg" : "png");
    expect((await sharp(result.bytes).metadata()).format).toBe(format);
    const padded = new Blob(
      [new Uint8Array(bytes), new Uint8Array(NEWS_IMAGE_LIMIT - bytes.length)],
      { type: `image/${format}` },
    );
    expect((await validateNewsImage(padded)).extension).toBe(result.extension);
  }
  await expect(
    validateNewsImage(
      new Blob([new Uint8Array(NEWS_IMAGE_LIMIT + 1)], { type: "image/png" }),
    ),
  ).rejects.toThrow("10 MB");
  await expect(
    validateNewsImage(new Blob(["not an image"], { type: "image/png" })),
  ).rejects.toThrow("valid");
  await expect(
    validateNewsImage(new Blob(["<svg/>"], { type: "image/svg+xml" })),
  ).rejects.toThrow("JPG");
  const webp = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "red" },
  })
    .webp()
    .toBuffer();
  await expect(
    validateNewsImage(new Blob([new Uint8Array(webp)], { type: "image/png" })),
  ).rejects.toThrow("valid");
  expect(imagePart("../../Human Resources / HRMO")).toBe(
    "human-resources-hrmo",
  );
});
test("programs omit client IDs and require globally usable slugs; department shortcut resolves", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    id: "forged",
    slug: "public-program",
    name: "Program",
    description: "Body",
    category: "Services",
    status: "Active",
  }))
    form.set(key, value);
  expect(parseContent("programs", form)).not.toHaveProperty("id");
  form.set("slug", "../invalid");
  expect(() => parseContent("programs", form)).toThrow("slug");
  expect(collectionName("department-page-and-head")).toBe("departments");
});
