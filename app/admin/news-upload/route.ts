import { officeContext, contentAllowed } from "@/lib/offices/server";
import { NEWS_IMAGE_LIMIT } from "@/lib/admin/news-image";
export async function POST(request: Request) {
  // Next's internal request URL can use localhost behind a reverse proxy.
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
  const collection = input.collection ?? "news";
  if (collection !== "news" && collection !== "programs")
    return Response.json(
      { error: "Invalid image collection." },
      { status: 400 },
    );
  const department = context.offices.find((o) => o.id === input.officeId);
  if (
    !department ||
    !contentAllowed(
      context,
      collection,
      { office_id: department.id, content_scope: department.department },
      "write",
    )
  )
    return Response.json(
      { error: "No editing access to this department." },
      { status: 403 },
    );
  if (input.original) {
    const { data, error } = await context.client
      .from(collection)
      .select("*")
      .eq("id", input.original)
      .maybeSingle();
    if (error || !data || !contentAllowed(context, collection, data, "write"))
      return Response.json(
        { error: "No editing access to this record." },
        { status: 403 },
      );
  }
  if (
    !Number.isInteger(input.size) ||
    input.size <= 0 ||
    input.size > NEWS_IMAGE_LIMIT ||
    !["image/jpeg", "image/png"].includes(input.type)
  )
    return Response.json(
      { error: "Choose a JPG or PNG image up to 10 MB." },
      { status: 400 },
    );
  const path = `${collection}/${department.id}/${context.user.id}/${crypto.randomUUID()}.${input.type === "image/jpeg" ? "jpg" : "png"}`;
  const { data, error } = await context.client.storage
    .from("municipal-news-staging")
    .createSignedUploadUrl(path);
  if (error || !data)
    return Response.json(
      {
        error:
          "Cannot prepare upload. Apply migration 039 and check Storage permissions.",
      },
      { status: 400 },
    );
  return Response.json(
    { path, signedUrl: data.signedUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
