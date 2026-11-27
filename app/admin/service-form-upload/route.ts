import { officeContext, contentAllowed } from "@/lib/offices/server";
import { PDF_LIMIT } from "@/lib/admin/document-pdf-validation";
import {
  serviceFormName,
  serviceFormPrefix,
} from "@/lib/admin/service-form-validation";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  let sameOrigin = false;
  try {
    sameOrigin = Boolean(origin && new URL(origin).host === host);
  } catch {}
  const failure = (error: string, status = 400) =>
    Response.json(
      { error },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  if (!sameOrigin) return failure("Invalid request origin.", 403);
  const context = await officeContext(true);
  let input;
  try {
    input = await request.json();
  } catch {
    return failure("Invalid upload request.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    return failure("Invalid upload request.");
  const office = context.offices.find(
    (item) => item.id === input.officeId && item.active && !item.archived_at,
  );
  if (
    !office ||
    !contentAllowed(
      context,
      "services",
      { office_id: office.id, content_scope: office.department },
      "write",
    )
  )
    return failure("No editing access to this department.", 403);
  if (input.original) {
    const { data, error } = await context.client
      .from("services")
      .select("*")
      .eq("id", input.original)
      .maybeSingle();
    if (
      error ||
      !data ||
      data.office_id !== office.id ||
      data.content_scope !== office.department ||
      !contentAllowed(context, "services", data, "write")
    )
      return failure("No editing access to this service.", 403);
  }
  if (
    !Number.isInteger(input.size) ||
    input.size <= 0 ||
    input.size > PDF_LIMIT ||
    input.type !== "application/pdf"
  )
    return failure("Choose a PDF up to 10 MB.");
  try {
    serviceFormName(input.name);
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Choose a PDF file.",
    );
  }
  const path = `${serviceFormPrefix(office.id, context.user.id)}${crypto.randomUUID()}.pdf`;
  const { data, error } = await context.client.storage
    .from("municipal-document-staging")
    .createSignedUploadUrl(path);
  if (error || !data)
    return failure(
      "Cannot prepare form upload. Apply migration 038 and check Storage permissions.",
    );
  return Response.json(
    { path, signedUrl: data.signedUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
