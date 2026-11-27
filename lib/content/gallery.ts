export const GALLERY_IMAGE_LIMIT = 12;
export const GALLERY_FILE_LIMIT = 10 * 1024 * 1024;

/** Only existing references may be retained; new photos must use validated uploads. */
export function gallerySelection(form: FormData, existing: unknown) {
  const current = Array.isArray(existing)
    ? existing.filter((value): value is string => typeof value === "string")
    : [];
  const parse = (name: string) => {
    const raw = form.get(name);
    if (raw === null) return null;
    if (typeof raw !== "string" || raw.length > 30000)
      throw new Error("Invalid gallery selection. Reload and try again.");
    const values: unknown = JSON.parse(raw);
    if (
      !Array.isArray(values) ||
      values.length > GALLERY_IMAGE_LIMIT ||
      values.some((value) => typeof value !== "string") ||
      new Set(values).size !== values.length
    )
      throw new Error("Choose up to 12 additional photos, without duplicates.");
    return values as string[];
  };
  const retained = parse("gallery_keep") ?? current;
  if (retained.some((url) => !current.includes(url)))
    throw new Error(
      "An existing gallery photo is unavailable. Reload and try again.",
    );
  const staged = parse("gallery_upload_paths") ?? [];
  if (retained.length + staged.length > GALLERY_IMAGE_LIMIT)
    throw new Error("Choose up to 12 additional photos.");
  return { retained, staged };
}
