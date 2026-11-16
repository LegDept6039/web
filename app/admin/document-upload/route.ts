import { officeContext, contentAllowed } from "@/lib/offices/server";
import { collectionName } from "@/lib/admin/content";
import { definitions } from "@/lib/content/schema";
import { isDocumentCollection } from "@/lib/legislative/config";
import { transparencyAccess } from "@/lib/transparency/permissions";
import {
  PDF_LIMIT,
  documentPdfPrefix,
} from "@/lib/admin/document-pdf-validation";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  let sameOrigin = false;
  try {
    sameOrigin = Boolean(origin && new URL(origin).host === host);
  } catch {}
  if (!sameOrigin)
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await officeContext(true);
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid upload request." }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    return Response.json({ error: "Invalid upload request." }, { status: 400 });
  if (input.scope === "transparency") {
    if (!transparencyAccess(context.profile, true))
      return Response.json(
        { error: "Transparency editing access required." },
        { status: 403 },
      );
    if (input.original) {
      const { data } = await context.client
        .from("municipal_documents")
        .select("id")
        .eq("id", input.original)
        .eq("content_scope", "transparency")
        .is("deleted_at", null)
        .maybeSingle();
      if (!data)
        return Response.json(
          { error: "Document unavailable." },
          { status: 403 },
        );
    }
    if (
      !Number.isInteger(input.size) ||
      input.size <= 0 ||
      input.size > PDF_LIMIT ||
      input.type !== "application/pdf"
    )
      return Response.json(
        { error: "Choose a PDF up to 10 MB." },
        { status: 400 },
      );
    const path = `transparency/${context.user.id}/${crypto.randomUUID()}.pdf`;
    const { data, error } = await context.client.storage
      .from("municipal-document-staging")
      .createSignedUploadUrl(path);
    if (error || !data)
      return Response.json(
        {
          error:
            "Cannot prepare PDF upload. Apply migration 016 and check Storage access.",
        },
        { status: 400 },
      );
    return Response.json(
      { path, signedUrl: data.signedUrl },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const collection = collectionName(String(input.collection));
  if (!collection || !isDocumentCollection(collection))
    return Response.json(
      { error: "Choose a Legislative document." },
      { status: 400 },
    );
  const office = context.offices.find(
    (o) =>
      o.id === input.officeId && o.active && o.department === "legislative",
  );
  if (
    !office ||
    !contentAllowed(
      context,
      collection,
      { office_id: office.id, content_scope: "legislative" },
      "write",
    )
  )
    return Response.json(
      { error: "No editing access to Legislative documents." },
      { status: 403 },
    );
  if (input.original) {
    const { data, error } = await context.client
      .from(definitions[collection].table)
      .select("*")
      .eq("id", input.original)
      .maybeSingle();
    if (
      error ||
      !data ||
      !data.published ||
      data.office_id !== office.id ||
      data.content_scope !== "legislative" ||
      !contentAllowed(context, collection, data, "write")
    )
      return Response.json(
        { error: "No editing access to this document." },
        { status: 403 },
      );
  }
  if (
    !Number.isInteger(input.size) ||
    input.size <= 0 ||
    input.size > PDF_LIMIT ||
    input.type !== "application/pdf"
  )
    return Response.json(
      { error: "Choose a PDF up to 10 MB." },
      { status: 400 },
    );
  const path = `${documentPdfPrefix(office.id, context.user.id, collection)}${crypto.randomUUID()}.pdf`;
  const { data, error } = await context.client.storage
    .from("municipal-document-staging")
    .createSignedUploadUrl(path);
  if (error || !data)
    return Response.json(
      {
        error:
          "Cannot prepare PDF upload. Apply migration 015 and check Storage permissions.",
      },
      { status: 400 },
    );
  return Response.json(
    { path, signedUrl: data.signedUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
