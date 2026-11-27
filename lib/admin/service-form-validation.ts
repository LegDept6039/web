import { validDocumentPdfPath } from "./document-pdf-validation";

export const SERVICE_FORM_BUCKET = "municipal-service-forms";

export function serviceFormPrefix(officeId: string, userId: string) {
  return `services/${officeId}/${userId}/`;
}

export function validServiceFormPath(path: string, officeId?: string) {
  const match =
    /^services\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/([0-9a-f-]{36}\.pdf)$/.exec(
      path,
    );
  return Boolean(match && (!officeId || match[1] === officeId));
}

export function serviceFormName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (
    !name ||
    name.length > 180 ||
    /[\x00-\x1f\x7f/\\]/.test(name) ||
    !/\.pdf$/i.test(name)
  )
    throw new Error("Use a PDF filename up to 180 characters without slashes.");
  return name;
}

/** Only the signed-in uploader's newly staged PDF can become an attachment. */
export function validStagedServiceFormPath(
  path: string,
  officeId: string,
  userId: string,
) {
  return validDocumentPdfPath(path, serviceFormPrefix(officeId, userId));
}

export function serviceFormSelection(
  form: FormData,
  officeId: string,
  userId: string,
  original: Record<string, unknown> | null,
):
  | { form_path: string | null; form_name: string | null }
  | { stagedPath: string; name: string } {
  const stagedPath = String(form.get("service_form_upload_path") || "");
  const remove = form.get("remove_service_form") === "on";
  if (stagedPath && remove)
    throw new Error(
      "Choose a replacement form or remove the current form, then save.",
    );
  if (remove) return { form_path: null, form_name: null };
  if (!stagedPath)
    return {
      form_path:
        typeof original?.form_path === "string" ? original.form_path : null,
      form_name:
        typeof original?.form_name === "string" ? original.form_name : null,
    };
  if (!validStagedServiceFormPath(stagedPath, officeId, userId))
    throw new Error("Invalid form upload reference. Select the PDF again.");
  return { stagedPath, name: serviceFormName(form.get("service_form_name")) };
}
