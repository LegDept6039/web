import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readContentConfig } from "@/lib/content/config";
import { officeContext, contentAllowed } from "@/lib/offices/server";
import {
  SERVICE_FORM_BUCKET,
  serviceFormName,
  validServiceFormPath,
} from "@/lib/admin/service-form-validation";

/** Resolve visibility afresh on every download; no draft bytes enter a shared cache. */
export async function serviceFormDownload(id: string, preview = false) {
  const missing = () =>
    new Response("Form unavailable", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  const context = preview ? await officeContext() : null;
  const config = context ? null : readContentConfig(process.env);
  if (!context && config?.source !== "supabase") return missing();
  const client =
    context?.client ||
    (config?.source === "supabase"
      ? createClient(config.supabase.url, config.supabase.key, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null);
  if (!client) return missing();
  let query = client
    .from("services")
    .select("id,office_id,content_scope,published,form_path,form_name")
    .eq("id", id);
  if (!preview) query = query.eq("published", true);
  const { data: service, error } = await query.maybeSingle();
  if (
    error ||
    !service ||
    !service.office_id ||
    !service.form_path ||
    !validServiceFormPath(service.form_path, service.office_id)
  )
    return missing();
  if (context && !contentAllowed(context, "services", service, "read"))
    return missing();
  let owner = client
    .from("departments")
    .select("id")
    .eq("id", service.office_id)
    .eq("department", service.content_scope)
    .eq("active", true)
    .is("archived_at", null);
  if (!preview) owner = owner.eq("published", true);
  if (!(await owner.maybeSingle()).data) return missing();
  let name;
  try {
    name = serviceFormName(service.form_name);
  } catch {
    return missing();
  }
  const result = await client.storage
    .from(SERVICE_FORM_BUCKET)
    .download(service.form_path);
  if (result.error || !result.data) return missing();
  return new Response(result.data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="service-form.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
