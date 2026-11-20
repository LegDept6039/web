"use server";
import { assignRecordTerm } from "@/lib/legislative/term-assignment";
import { validateRichText, richTextPlain } from "@/lib/content/rich-text";
import { saveError } from "@/lib/admin/publication";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { officeContext, contentAllowed, allowed } from "@/lib/offices/server";
import { collectionName, parseContent } from "@/lib/admin/content";
import { uploadOfficialPhoto } from "@/lib/admin/photo";
import { uploadNewsImage } from "@/lib/admin/news-image";
import { uploadFile } from "@/lib/admin/upload-file";
import { legislativeRoles, isLegislativeRole } from "@/lib/officials/roles";
import { parseLegislative } from "@/lib/legislative/validation";
import {
  usesLegislativeFields,
  isDocumentCollection,
} from "@/lib/legislative/config";
import { uploadDocumentPdf } from "@/lib/admin/document-pdf";
import { definitions } from "@/lib/content/schema";
import { serviceExcerpt } from "@/lib/content/service";

export async function saveContent(
  _state: string,
  form: FormData,
): Promise<string> {
  const context = await officeContext(true);
  const { client } = context;
  let image: File | null, photo: File | null;
  try {
    image = uploadFile(form, "department_image");
    photo = uploadFile(form, "photo");
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid image attachment.";
  }
  const collection = collectionName(String(form.get("collection")));
  if (!collection) return "Unknown content collection.";
  const definition = definitions[collection];
  const scope =
    form.get("content_scope") === "legislative" ? "legislative" : "executive";
  const original = String(form.get("original") || "");
  if (["news", "programs", "services"].includes(collection) && original)
    form.set("id", original);
  if (collection === "news")
    form.set("image", "/images/department-placeholder.svg");
  if (collection === "contacts") {
    const value = String(form.get("value") || "").trim();
    if (!value || value.length > 1000)
      return "Enter a contact value up to 1000 characters.";
    if (
      form.get("type") === "EMAIL" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    )
      return "Enter a valid email address.";
  }
  if (collection === "departments") {
    if (!original)
      return "Create departments in Superadmin Department Management.";
    form.set("head_photo", "");
    form.set("image_url", "");
    const { data: department, error } = await client
      .from("departments")
      .select("*")
      .eq("id", original)
      .maybeSingle();
    if (
      error ||
      !department ||
      !contentAllowed(context, collection, department, "write")
    )
      return "This record is unavailable or you do not have editing access.";
    for (const key of [
      "name",
      "short_name",
      "slug",
      "active",
      "published",
      "sort_order",
      "is_sample",
    ]) {
      const expected =
        typeof department[key] === "boolean"
          ? department[key]
            ? "on"
            : ""
          : String(department[key] ?? "");
      if (form.has(key) && String(form.get(key)) !== expected)
        return "Department identity and publication settings can only be changed in Superadmin Department Management.";
      form.set(key, expected);
    }
  }
  if (collection === "officials") {
    if (scope === "legislative") {
      const role = form.get("legislative_role");
      if (!isLegislativeRole(role))
        return "Choose a Legislative official role.";
      form.set("role", legislativeRoles[role]);
      form.set("branch", "legislative");
    } else {
      form.set("legislative_role", "");
      form.set("branch", "executive");
    }
    if (original) form.set("id", original);
    form.set("photo_url", ""); // Never trust a client-supplied storage URL.
  }
  const executiveOffices = context.offices.filter(
    (o) => o.department === "executive" && allowed(context, o.id, "write"),
  );
  let office =
    scope === "legislative"
      ? context.offices.find((o) => o.department === "legislative")?.id || null
      : String(
          form.get("office_id") ||
            (context.profile.role !== "superadmin" &&
            executiveOffices.length === 1
              ? executiveOffices[0].id
              : ""),
        ) || null;
  form.set("office_id", office || "");
  form.set("content_scope", scope);
  let existing: Record<string, unknown> | null = null;
  if (original) {
    const result = await client
      .from(definition.table)
      .select("*")
      .eq(definition.key, original)
      .maybeSingle();
    existing = result.data;
    if (existing?.content_scope === "transparency")
      return "Manage this record in Superadmin Transparency.";
    if (
      result.error ||
      !existing ||
      !contentAllowed(context, collection, existing, "write")
    )
      return "This record is unavailable or you do not have editing access.";
    // Editing Legislative content must retain its stored owner, even if
    // another Legislative office sorts first in the navigation list.
    if (scope === "legislative" && existing.content_scope === "legislative") {
      office =
        typeof existing.office_id === "string" ? existing.office_id : null;
      form.set("office_id", office || "");
    }
    if (
      context.profile.role !== "superadmin" &&
      (existing.content_scope !== scope || existing.office_id !== office)
    )
      return "Only a Super Admin can transfer content scope.";
  }
  if (collection === "news") {
    if (!office)
      return "Choose the owning office before saving this news article.";
    const owner = context.offices.find(
      (item) => item.id === office && item.department === scope,
    );
    if (!owner) return "You do not have permission to edit this office.";
    // Category follows trusted ownership, never a separate client-supplied label.
    form.set("category", owner.name);
  }
  if (collection === "services") {
    const owner = context.offices.find(
      (item) => item.id === office && item.department === scope && item.active,
    );
    if (!owner || !allowed(context, owner.id, "write"))
      return "Choose an owning department you have permission to edit.";
    // The form edits title and body only. Legacy presentation fields and
    // ownership labels are derived here, never taken from submitted values.
    form.set("office", owner.name);
    form.set(
      "icon",
      typeof existing?.icon === "string" ? existing.icon : "file",
    );
    form.set("description", serviceExcerpt(String(form.get("body") || "")));
    form.set("steps", "");
    form.set("is_sample", existing?.is_sample === true ? "on" : "");
  }
  let row: Record<string, unknown>;
  try {
    row =
      scope === "legislative" && usesLegislativeFields(collection)
        ? parseLegislative(collection, form, existing)
        : parseContent(collection, form);
    if (collection === "services")
      row.steps = Array.isArray(existing?.steps) ? existing.steps : [];
    if (["news", "programs"].includes(collection) && form.has("rich_body")) {
      const raw = String(form.get("rich_body"));
      if (raw.length > 200000) return "Content is too long.";
      const doc = validateRichText(JSON.parse(raw), true);
      row.rich_body = doc;
      if (collection === "news") row.content = richTextPlain(doc).split("\n");
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Check the form fields.";
  }
  // These images are rendered by next/image, whose remote source is restricted.
  for (const column of ["image", "photo_url"]) {
    const value = row[column];
    if (typeof value === "string" && !value.startsWith("/")) {
      const url = new URL(value);
      if (
        url.origin !== process.env.SUPABASE_URL?.replace(/\/$/, "") ||
        !url.pathname.startsWith(
          "/storage/v1/object/public/municipal-media/",
        ) ||
        url.search
      )
        return "Use a local image path or an image from the municipal-media bucket.";
    }
  }
  row.office_id = office;
  row.content_scope = scope;
  if (!contentAllowed(context, collection, row, "write"))
    return "You do not have permission to manage content in this office.";
  if (scope === "legislative" && collection === "committees") {
    const master = await client
      .from("committee_master")
      .select("id,name")
      .eq("id", row.master_id)
      .maybeSingle();
    if (master.error || !master.data)
      return "Choose an existing Master Committee.";
    row.name = existing ? existing.name : master.data.name;
  }
  if (["news", "programs", "departments"].includes(collection) && !office)
    return "Choose an owning office for this content.";
  if (
    scope === "legislative" &&
    (usesLegislativeFields(collection) || collection === "officials")
  ) {
    try {
      await assignRecordTerm(client, collection, row, form);
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "Check the assigned term.";
    }
    for (const column of [
      "author_id",
      "co_author_id",
      "chair_id",
      "vice_chair_id",
      "member_1_id",
      "member_2_id",
      "member_3_id",
      "member_4_id",
      "committee_id",
      "session_id",
    ]) {
      if (!row[column]) continue;
      const relatedCollection =
        column === "committee_id"
          ? "committees"
          : column === "session_id"
            ? "sessions"
            : "officials";
      const related = await client
        .from(relatedCollection)
        .select("*")
        .eq("id", row[column])
        .maybeSingle();
      if (
        related.error ||
        !related.data ||
        related.data.content_scope !== "legislative" ||
        related.data.office_id !== office ||
        related.data.term_id !== row.term_id ||
        !contentAllowed(context, relatedCollection, related.data, "read")
      )
        return "Choose a related record from the same Legislative office and term.";
      if (
        ["author_id", "co_author_id"].includes(column) &&
        related.data.legislative_role !== "SANGGUNIANG_BAYAN"
      )
        return "Authors and co-authors must be Sangguniang Bayan members.";
    }
  }
  const photoColumn = collection === "departments" ? "head_photo" : "photo_url";
  if (["officials", "departments"].includes(collection))
    row[photoColumn] =
      form.get("remove_photo") === "on"
        ? null
        : existing?.[photoColumn] || null;
  if (original && original !== row[definition.key])
    return "An existing record ID cannot be changed.";
  let newsImage: Awaited<ReturnType<typeof uploadNewsImage>> | undefined;
  if (collection === "news") {
    // Allocate a stable server UUID before naming the image; the same UUID is inserted.
    row.id = original || crypto.randomUUID();
    row.image = existing?.image || "/images/department-placeholder.svg";
    const stagedPath = String(form.get("news_upload_path") || "");
    if (stagedPath) {
      const department = context.offices.find((o) => o.id === office);
      if (!department) return "Choose an owning department.";
      try {
        newsImage = await uploadNewsImage(
          client,
          context.user.id,
          department,
          String(row.id),
          String(row.slug),
          stagedPath,
        );
        row.image = newsImage.url;
        row.image_path = newsImage.path;
        row.image_mime = newsImage.mime;
        row.image_size = newsImage.size;
      } catch (error) {
        return error instanceof Error ? error.message : "Image upload failed.";
      }
    }
  }
  if (collection === "departments")
    row.image_url =
      form.get("remove_image") === "on" ? null : existing?.image_url || null;
  let departmentImage:
    Awaited<ReturnType<typeof uploadOfficialPhoto>> | undefined;
  if (collection === "departments" && image) {
    try {
      departmentImage = await uploadOfficialPhoto(
        client,
        context.user.id,
        image,
        "departments",
      );
      row.image_url = departmentImage.url;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "Department image upload failed.";
    }
  }
  let uploaded: Awaited<ReturnType<typeof uploadOfficialPhoto>> | undefined;
  if (["officials", "departments"].includes(collection) && photo) {
    try {
      uploaded = await uploadOfficialPhoto(
        client,
        context.user.id,
        photo,
        collection === "departments" ? "departments" : "officials",
      );
      row[photoColumn] = uploaded.url;
    } catch (error) {
      if (departmentImage)
        await client.storage
          .from("municipal-media")
          .remove([departmentImage.path]);
      return error instanceof Error ? error.message : "Photo upload failed.";
    }
  }
  if (collection === "departments") {
    delete row.office_id;
    delete row.content_scope;
    if (context.profile.role !== "superadmin") row.active = existing?.active;
    row.body ||= "";
    row.head_description ||= "";
    row.short_name ||= "";
  }
  let documentPdf: Awaited<ReturnType<typeof uploadDocumentPdf>> | undefined;
  if (scope === "legislative" && isDocumentCollection(collection)) {
    const column = collection === "documents" ? "file_url" : "pdf_url";
    row[column] =
      existing?.[column] || (collection === "documents" ? "" : null);
    const stagedPath = String(form.get("document_upload_path") || "");
    if (stagedPath) {
      if (!office) return "Choose a Legislative office.";
      try {
        documentPdf = await uploadDocumentPdf(
          client,
          context.user.id,
          office,
          collection,
          stagedPath,
        );
        row[column] = documentPdf.url;
      } catch (error) {
        return error instanceof Error ? error.message : "PDF upload failed.";
      }
    }
  }
  const result = original
    ? await client
        .from(definition.table)
        .update(row)
        .eq(definition.key, original)
        .eq("updated_at", String(form.get("updated_at")))
        .select(definition.key)
    : await client.from(definition.table).insert(row).select(definition.key);
  if ((result.error || !result.data?.length) && documentPdf)
    await client.storage.from("municipal-media").remove([documentPdf.path]);
  if ((result.error || !result.data?.length) && uploaded) {
    await client.storage.from("municipal-media").remove([uploaded.path]);
  }
  if ((result.error || !result.data?.length) && newsImage)
    await client.storage.from("municipal-media").remove([newsImage.path]);
  if ((result.error || !result.data?.length) && departmentImage)
    await client.storage.from("municipal-media").remove([departmentImage.path]);
  if (
    result.error?.code === "23514" &&
    [
      "No Legislative Term covers this date.",
      "Related records must belong to the same Legislative Term",
      "Assign the selected session to a Legislative Term first",
      "This record is referenced by records in another term.",
      "Choose a Legislative Term",
    ].some((message) => result.error!.message.startsWith(message))
  )
    return result.error.message;
  if (result.error?.code === "23505" && collection === "committees")
    return "This master committee already has a composition for that term. Open the existing record from Committees.";
  if (result.error)
    return (
      saveError(result.error.code) ||
      (result.error.code === "23505"
        ? "That ID or slug already exists. Choose a unique slug."
        : result.error.code === "23503"
          ? "Choose an existing related record (for example, a document category)."
          : "Could not save. Check the fields and your access, then try again.")
    );
  if (!result.data?.length)
    return "This record changed or your access was removed. Reload before saving.";
  revalidatePath("/", "layout");
  redirect(
    `/admin/content/${collection}?saved=${encodeURIComponent(String((result.data[0] as unknown as Record<string, unknown>)[definition.key]))}${office ? `&office=${office}` : ""}${collection === "committees" && row.term_id ? `&term=${encodeURIComponent(String(row.term_id))}` : ""}`,
  );
}

export async function deleteContent(
  _state: string,
  form: FormData,
): Promise<string> {
  const context = await officeContext(true);
  const { client } = context;
  const collection = collectionName(String(form.get("collection")));
  if (!collection || form.get("confirm") !== "on")
    return "Confirm deletion first.";
  const definition = definitions[collection];
  const { data: existing, error: readError } = await client
    .from(definition.table)
    .select("*")
    .eq(definition.key, String(form.get("original")))
    .maybeSingle();
  if (existing?.content_scope === "transparency")
    return "Unpublish this record in Superadmin Transparency to preserve its files.";
  if (
    readError ||
    !existing ||
    !contentAllowed(context, collection, existing, "delete")
  )
    return "You do not have permission to delete this record.";
  const { data, error } = await client
    .from(definition.table)
    .delete()
    .eq(definition.key, String(form.get("original")))
    .eq("updated_at", String(form.get("updated_at")))
    .select(definition.key);
  if (error)
    return (
      saveError(error.code) ||
      "Could not delete. Remove related records first and check your access."
    );
  if (!data?.length)
    return "This record changed or no longer exists. Reload the page.";
  revalidatePath("/", "layout");
  redirect(
    `/admin/content/${collection}${existing.office_id ? `?office=${existing.office_id}` : ""}`,
  );
}
