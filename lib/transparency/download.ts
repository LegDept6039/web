import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readContentConfig } from "@/lib/content/config";
import { requireTransparency } from "./server";
import { isReportSlot, slotsFor } from "./config";
export async function transparencyDownload(
  request: Request,
  id: string,
  preview = false,
) {
  const period = new URL(request.url).searchParams.get("period") || "annual";
  const missing = () =>
    new Response("File unavailable", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  if (!isReportSlot(period)) return missing();
  let client;
  if (preview) client = (await requireTransparency()).client;
  else {
    const config = readContentConfig(process.env);
    if (config.source !== "supabase") return missing();
    client = createClient(config.supabase.url, config.supabase.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  let query = client
    .from("municipal_documents")
    .select("*")
    .eq("id", id)
    .eq("content_scope", "transparency")
    .is("deleted_at", null);
  if (!preview) query = query.eq("published", true);
  const { data } = await query.maybeSingle();
  if (
    !data ||
    !slotsFor(data.report_frequency).includes(period) ||
    !data[period + "_pdf_path"]
  )
    return missing();
  let moduleQuery = client
    .from("document_categories")
    .select("id")
    .eq("id", data.category_id)
    .eq("content_scope", "transparency")
    .is("deleted_at", null);
  if (!preview) moduleQuery = moduleQuery.eq("published", true);
  if (!(await moduleQuery.maybeSingle()).data) return missing();
  const result = await client.storage
    .from("municipal-transparency")
    .createSignedUrl(data[period + "_pdf_path"], 60);
  if (!result.data) return missing();
  return new Response(null, {
    status: 302,
    headers: {
      Location: result.data.signedUrl,
      "Cache-Control": "private, no-store",
    },
  });
}
