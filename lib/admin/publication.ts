export function publicationPosition(form: FormData) {
  if (form.get("published") !== "on") return 0;
  const value = String(form.get("sort_order") || "").trim();
  const position = Number(value);
  if (
    !value ||
    !Number.isSafeInteger(position) ||
    position < 1 ||
    position > 2147483647
  )
    throw new Error("Choose a positive sort position before publishing.");
  return position;
}
export function saveError(code?: string) {
  if (["40001", "40P01"].includes(code || ""))
    return "The ordering changed while you were editing. Reload this page and try again.";
  if (code === "23514")
    return "Check the published position and content formatting, then try again.";
  return undefined;
}
