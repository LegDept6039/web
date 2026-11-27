import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { storeDocumentPdf } from "./document-pdf";
import {
  SERVICE_FORM_BUCKET,
  serviceFormPrefix,
  serviceFormSelection,
} from "./service-form-validation";

export async function prepareServiceForm(
  client: SupabaseClient,
  userId: string,
  officeId: string,
  form: FormData,
  original: Record<string, unknown> | null,
): Promise<{
  values: { form_path: string | null; form_name: string | null };
  uploadedPath?: string;
}> {
  const selection = serviceFormSelection(form, officeId, userId, original);
  if (!("stagedPath" in selection)) return { values: selection };
  const path = await storeDocumentPdf(
    client,
    selection.stagedPath,
    serviceFormPrefix(officeId, userId),
    SERVICE_FORM_BUCKET,
  );
  return {
    values: { form_path: path, form_name: selection.name },
    uploadedPath: path,
  };
}
