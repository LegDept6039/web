"use server";
import { requireTransparency } from "@/lib/transparency/server";
import { reportSlots, slotsFor } from "@/lib/transparency/config";
import { storeDocumentPdf } from "@/lib/admin/document-pdf";
import { saveError } from "@/lib/admin/publication";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
function refresh() {
  revalidatePath("/transparency", "layout");
  revalidatePath("/admin/transparency", "layout");
  revalidatePath("/superadmin/transparency", "layout");
}
export async function saveTransparency(
  _state: string,
  form: FormData,
): Promise<string> {
  const kind = String(form.get("kind"));
  if (!["categories", "documents"].includes(kind))
    return "Unknown record type.";
  const category = kind === "categories";
  const { client, user } = await requireTransparency(true);
  const table = category ? "document_categories" : "municipal_documents";
  const original = String(form.get("original") || "");
  let existing: Record<string, unknown> | undefined;
  if (original) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq("id", original)
      .eq("content_scope", "transparency")
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !data) return "Record unavailable.";
    if (data.updated_at !== form.get("updated_at"))
      return "This record changed. Reload before saving.";
    existing = data;
  }
  const title = String(form.get("title") || "").trim();
  const description = String(form.get("description") || "").trim();
  if (!title || title.length > 300 || description.length > 10000)
    return "Enter a name or title up to 300 characters and a description up to 10,000 characters.";
  const published = category || form.get("status") === "published";
  const id = original || crypto.randomUUID();
  const uploaded: string[] = [];
  try {
    let position =
      published && existing?.published ? Number(existing.sort_order) : 0;
    if (published && !position) {
      const { count, error } = await client
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("content_scope", "transparency")
        .eq("published", true);
      if (error) return "Unable to determine report order. Retry.";
      position = (count || 0) + 1;
    }
    const row: Record<string, unknown> = {
      content_scope: "transparency",
      office_id: null,
      description,
      published,
      sort_order: position,
      is_sample: false,
    };
    if (!original) Object.assign(row, { id, created_by: user.id });
    if (category) Object.assign(row, { name: title, href: null });
    else {
      const frequency = String(form.get("report_frequency"));
      const year = Number(form.get("report_year"));
      if (
        !["annual", "quarterly"].includes(frequency) ||
        !Number.isInteger(year) ||
        year < 1900 ||
        year > 9999
      )
        return "Choose Annual or Quarterly and a valid year.";
      if (!["draft", "published"].includes(String(form.get("status"))))
        return "Choose Draft or Published.";
      const categoryId = String(form.get("category_id") || "");
      const { data: parent } = await client
        .from("document_categories")
        .select("id,published")
        .eq("id", categoryId)
        .eq("content_scope", "transparency")
        .is("deleted_at", null)
        .maybeSingle();
      if (!parent || (published && !parent.published))
        return "Choose an available Transparency module before publishing.";
      const activeSlots = slotsFor(frequency);
      for (const slot of reportSlots) {
        const column = slot + "_pdf_path";
        let path = existing?.[column] || null;
        if (form.get("remove_" + slot) === "on") path = null;
        const staged = String(form.get("staged_" + slot) || "");
        if (!activeSlots.includes(slot) && (path || staged))
          throw new Error(
            "Remove existing attachments and save a draft before changing frequency.",
          );
        if (staged) {
          path = await storeDocumentPdf(
            client,
            staged,
            "transparency/" + user.id + "/",
            "municipal-transparency",
          );
          uploaded.push(String(path));
        }
        row[column] = path;
      }
      if (published && !activeSlots.some((slot) => row[slot + "_pdf_path"]))
        throw new Error(
          "Attach at least one PDF before publishing. Quarterly reports may be completed later.",
        );
      Object.assign(row, {
        title,
        date: String(existing?.date || "").startsWith(year + "-")
          ? existing?.date
          : year + "-01-01",
        report_frequency: frequency,
        report_year: year,
        category_id: categoryId,
        document_type: null,
        session_id: null,
        attachment_path: row.annual_pdf_path,
        file_url: "/transparency/files/" + id,
      });
    }
    const result = original
      ? await client
          .from(table)
          .update(row)
          .eq("id", original)
          .eq("content_scope", "transparency")
          .is("deleted_at", null)
          .eq("updated_at", existing!.updated_at)
          .select("id")
      : await client.from(table).insert(row).select("id");
    if (result.error || !result.data?.length)
      throw new Error(
        saveError(result.error?.code) ||
          "Could not save. Reload and check migration 017 and publication settings.",
      );
  } catch (error) {
    if (uploaded.length)
      await client.storage.from("municipal-transparency").remove(uploaded);
    return error instanceof Error ? error.message : "Unable to save.";
  }
  refresh();
  redirect(category ? "/admin/transparency/modules" : "/admin/transparency");
}
export async function deleteTransparency(
  _state: string,
  form: FormData,
): Promise<string> {
  const kind = String(form.get("kind"));
  if (
    !["categories", "documents"].includes(kind) ||
    form.get("confirm") !== "on"
  )
    return "Confirm deletion first.";
  const category = kind === "categories";
  const { client } = await requireTransparency(true);
  const table = category ? "document_categories" : "municipal_documents";
  const id = String(form.get("original") || "");
  const { data: existing, error } = await client
    .from(table)
    .select("*")
    .eq("id", id)
    .eq("content_scope", "transparency")
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !existing) return "Record unavailable.";
  if (existing.updated_at !== form.get("updated_at"))
    return "This record changed. Reload before deleting.";
  if (category) {
    const { count, error } = await client
      .from("municipal_documents")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id)
      .is("deleted_at", null);
    if (error) return "Unable to check module documents.";
    if (count) return "Move or delete the reports in this module first.";
  }
  const result = await client
    .from(table)
    .update({
      deleted_at: new Date().toISOString(),
      published: false,
      sort_order: 0,
    })
    .eq("id", id)
    .eq("content_scope", "transparency")
    .is("deleted_at", null)
    .eq("updated_at", existing.updated_at)
    .select("id");
  if (result.error || !result.data?.length)
    return "Could not delete. Reload and check whether this module still contains reports.";
  refresh();
  redirect(category ? "/admin/transparency/modules" : "/admin/transparency");
}
