"use server";
import { validateBiography } from "@/lib/content/department-biography";
import { publicationPosition, saveError } from "@/lib/admin/publication";
import { uploadOfficialPhoto } from "@/lib/admin/photo";
import { uploadFile } from "@/lib/admin/upload-file";
import { requireStaff } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isBarangayAffairsOffice } from "@/lib/barangays/permissions";
export async function saveOffice(
  _state: string,
  form: FormData,
): Promise<string> {
  return saveDepartment(form, false);
}
export async function saveBranch(
  _state: string,
  form: FormData,
): Promise<string> {
  return saveDepartment(form, true);
}
async function saveDepartment(
  form: FormData,
  branchMode: boolean,
): Promise<string> {
  const { client, user } = await requireStaff(true, true);
  const id = String(form.get("id") || "");
  if (
    branchMode && !id &&
    (!String(form.get("parent_department_id") || "").trim() ||
      form.get("department") !== "executive")
  ) return "Choose an Executive parent department for the new branch.";
  if (id) {
    const { data: workspace, error } = await client
      .from("departments")
      .select("id,slug,department")
      .eq("id", id)
      .maybeSingle();
    if (error) return "Unable to load this department. Reload before saving.";
    if (isBarangayAffairsOffice(workspace)) {
      const { data, error: updateError } = await client
        .from("departments")
        .update({ active: form.get("active") === "on" })
        .eq("id", id)
        .eq("updated_at", String(form.get("updated_at")))
        .select("id");
      if (updateError || !data?.length)
        return "Unable to update Barangay Affairs access. Reload before saving.";
      revalidatePath("/", "layout");
      redirect("/superadmin/departments");
    }
  }
  let position: number;
  try {
    validateBiography(String(form.get("head_description") || ""));
    position = publicationPosition(form);
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Choose a published position.";
  }
  const row = {
    name: String(form.get("name") || "").trim(),
    short_name: String(form.get("short_name") || "").trim(),
    slug: String(form.get("slug") || "").trim(),
    department: String(form.get("department") || ""),
    parent_department_id:
      String(form.get("parent_department_id") || "").trim() || null,
    description: String(form.get("description") || "").trim(),
    active: form.get("active") === "on",
    published: form.get("published") === "on",
    sort_order: position,
    body: String(form.get("body") || "").trim(),
    head_name: String(form.get("head_name") || "").trim() || null,
    head_title: String(form.get("head_title") || "").trim() || null,
    head_description: validateBiography(
      String(form.get("head_description") || ""),
    ).trim(),
    head_photo: null as string | null,
    image_url: null as string | null,
  };
  if (
    !Number.isInteger(row.sort_order) ||
    Math.abs(row.sort_order) > 2147483647 ||
    row.body.length > 30000 ||
    row.head_description.length > 10000 ||
    (row.head_name?.length || 0) > 300 ||
    (row.head_title?.length || 0) > 300 ||
    !row.name ||
    row.name.length > 160 ||
    row.short_name.length > 40 ||
    row.description.length > 10000 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) ||
    !["executive", "legislative"].includes(row.department)
  )
    return "Check the office name, slug, and department.";
  if (
    row.parent_department_id &&
    (row.department !== "executive" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        row.parent_department_id,
      ) ||
      row.parent_department_id === id)
  )
    return "Choose a different Executive department as the parent.";
  let existingParent: string | null = null;
  if (id) {
    const { data: existing, error } = await client
      .from("departments")
      .select("*")
      .eq("id", id)
      .is("archived_at", null)
      .maybeSingle();
    if (error || !existing) return "Department is unavailable.";
    if (existing.updated_at !== String(form.get("updated_at")))
      return "This department changed. Reload before saving.";
    if (existing.department !== row.department)
      return "The government branch cannot be changed after creation.";
    existingParent = existing.parent_department_id || null;
    row.head_photo =
      form.get("remove_photo") === "on" ? null : existing.head_photo;
    row.image_url =
      form.get("remove_image") === "on" ? null : existing.image_url;
  }
  if (row.parent_department_id) {
    const { data: parent, error } = await client
      .from("departments")
      .select("id,slug,department,parent_department_id,archived_at")
      .eq("id", row.parent_department_id)
      .maybeSingle();
    if (
      error ||
      !parent ||
      parent.department !== "executive" ||
      parent.parent_department_id ||
      isBarangayAffairsOffice(parent) ||
      (parent.archived_at && row.parent_department_id !== existingParent)
    )
      return "Choose a top-level Executive department as the parent.";
    if (id) {
      const { data: children, error: childError } = await client
        .from("departments")
        .select("id")
        .eq("parent_department_id", id)
        .limit(1);
      if (childError)
        return "Unable to check this department's branches. Reload before saving.";
      if (children?.length)
        return "A department with branches cannot itself become a branch.";
    }
  }
  const uploads: string[] = [];
  try {
    for (const [field, column] of [
      ["photo", "head_photo"],
      ["department_image", "image_url"],
    ] as const) {
      const file = uploadFile(form, field);
      if (file) {
        const uploaded = await uploadOfficialPhoto(
          client,
          user.id,
          file,
          "departments",
        );
        uploads.push(uploaded.path);
        row[column] = uploaded.url;
      }
    }
  } catch (error) {
    if (uploads.length)
      await client.storage.from("municipal-media").remove(uploads);
    return error instanceof Error ? error.message : "Image upload failed.";
  }
  const result = id
    ? await client
        .from("departments")
        .update(row)
        .eq("id", id)
        .eq("updated_at", String(form.get("updated_at")))
        .select("id,parent_department_id")
    : await client
        .from("departments")
        .insert(row)
        .select("id,parent_department_id");
  if ((result.error || !result.data?.length) && uploads.length)
    await client.storage.from("municipal-media").remove(uploads);
  if (result.error)
    return (
      saveError(result.error.code) ||
      (result.error.code === "23505"
        ? "That slug is already in use, or Legislative Access already exists."
        : "Unable to save office.")
    );
  if (!result.data?.length) return "This office changed. Reload before saving.";
  revalidatePath("/", "layout");
  redirect(
    result.data[0].parent_department_id
      ? "/superadmin/branches"
      : "/superadmin/departments",
  );
}
export async function deleteOffice(
  _state: string,
  form: FormData,
): Promise<string> {
  const { client } = await requireStaff(true, true);
  if (form.get("confirm") !== "on") return "Confirm deactivation first.";
  const { data, error } = await client
    .from("departments")
    .update({ active: false })
    .eq("id", String(form.get("id")))
    .eq("updated_at", String(form.get("updated_at")))
    .select("id,parent_department_id");
  if (error)
    return ["23503", "23001"].includes(error.code)
      ? "This office has assigned users or content. Deactivate it instead, or reassign its users and content first."
      : "Unable to deactivate department.";
  if (!data?.length)
    return "Office changed or no longer exists. Reload the page.";
  revalidatePath("/", "layout");
  redirect(
    data[0].parent_department_id
      ? "/superadmin/branches"
      : "/superadmin/departments",
  );
}
