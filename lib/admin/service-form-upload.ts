import { PDF_LIMIT } from "./document-pdf-validation";
import { serviceFormName } from "./service-form-validation";

/** PDF bytes go directly to private staging, never through a Server Action. */
export async function stageServiceFormUpload(
  form: FormData,
  officeId: string,
  onStatus: (status: string) => void,
) {
  const file = form.get("service_form_pdf");
  form.delete("service_form_pdf");
  if (!(file instanceof File) || !file.size) return;
  if (file.size > PDF_LIMIT || file.type !== "application/pdf")
    throw new Error("Choose a PDF up to 10 MB.");
  const name = serviceFormName(file.name);
  if (form.get("remove_service_form") === "on")
    throw new Error(
      "Choose a replacement form or remove the current form, then save.",
    );
  onStatus("Uploading service form...");
  const response = await fetch("/admin/service-form-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      officeId,
      original: form.get("original"),
      size: file.size,
      type: file.type,
      name,
    }),
  });
  const upload = await response.json();
  if (!response.ok)
    throw new Error(upload.error || "Unable to prepare form upload.");
  const result = await fetch(upload.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  });
  if (!result.ok) throw new Error("Form upload failed. Please retry.");
  form.set("service_form_upload_path", upload.path);
  form.set("service_form_name", name);
  onStatus("Checking PDF and saving service...");
}
