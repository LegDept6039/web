/**
 * A missing checkbox only means "hide" when the form rendered this setting.
 * Older forms and unrelated office saves must retain the stored preference.
 */
export function departmentHeadPhotoVisibility(
  form: FormData,
  current = true,
): boolean {
  if (form.get("show_head_photo_on_page") === "on") return true;
  if (form.get("head_photo_visibility_present") === "1") return false;
  return current;
}
