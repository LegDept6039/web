/** FormData files can come from a different runtime realm in development. */
export function uploadFile(form: FormData, name: string): File | null {
  const value = form.get(name);
  if (value == null || value === "") return null;
  if (
    typeof value === "string" ||
    typeof value.arrayBuffer !== "function" ||
    typeof value.size !== "number" ||
    typeof value.type !== "string"
  )
    throw new Error(
      "The selected image was not received. Select the file again.",
    );
  // Empty native inputs may arrive with a generated filename after serialization.
  if (!value.size) return null;
  return value;
}
