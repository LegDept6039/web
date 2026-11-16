import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  documentPdfPrefix,
  validDocumentPdfPath,
  validateDocumentPdf,
} from "./document-pdf-validation";

export async function uploadDocumentPdf(
  client: SupabaseClient,
  userId: string,
  officeId: string,
  collection: string,
  stagedPath: string,
) {
  const prefix = documentPdfPrefix(officeId, userId, collection);
  const path = await storeDocumentPdf(
    client,
    stagedPath,
    prefix,
    "municipal-media",
  );
  return {
    path,
    url: client.storage.from("municipal-media").getPublicUrl(path).data
      .publicUrl,
  };
}

export async function storeDocumentPdf(
  client: SupabaseClient,
  stagedPath: string,
  prefix: string,
  bucket: string,
) {
  if (!validDocumentPdfPath(stagedPath, prefix))
    throw new Error("Invalid PDF upload reference. Select the file again.");
  const staging = client.storage.from("municipal-document-staging");
  const { data, error } = await staging.download(stagedPath);
  if (error || !data)
    throw new Error("PDF upload is unavailable. Select it again and retry.");
  try {
    const bytes = await validateDocumentPdf(data);
    const path = `${prefix}${crypto.randomUUID()}.pdf`;
    const media = client.storage.from(bucket);
    const { error: uploadError } = await media.upload(path, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadError)
      throw new Error(
        "PDF could not be saved. Check the document Storage migration and access.",
      );
    return path;
  } finally {
    await staging.remove([stagedPath]);
  }
}
