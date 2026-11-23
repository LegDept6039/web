"use server";
import { requireStaff } from "@/lib/auth/server";
import { uploadOfficialPhoto } from "@/lib/admin/photo";
import { uploadFile } from "@/lib/admin/upload-file";
import { prepareBarangayValues } from "@/lib/barangays/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveBarangay(
  _state: string,
  form: FormData,
): Promise<string> {
  const { client, user } = await requireStaff(true, true);
  const id = String(form.get("id") || "");
  let storedSlug: string | undefined;
  let imageUrl: string | null = null;
  if (id) {
    const { data, error } = await client
      .from("barangays")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data || typeof data.slug !== "string" || !data.slug)
      return "This barangay is unavailable. Reload the list and try again.";
    if (data.updated_at !== String(form.get("updated_at")))
      return "This barangay changed since you opened it. Reload before saving.";
    storedSlug = data.slug;
    imageUrl = form.get("remove_image") === "on" ? null : data.image_url;
  }
  let values: ReturnType<typeof prepareBarangayValues>;
  try {
    values = prepareBarangayValues(Object.fromEntries(form), storedSlug);
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Check the barangay details.";
  }
  let uploaded: Awaited<ReturnType<typeof uploadOfficialPhoto>> | undefined;
  try {
    const file = uploadFile(form, "image");
    if (file) {
      uploaded = await uploadOfficialPhoto(client, user.id, file, "barangays");
      imageUrl = uploaded.url;
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Image upload failed.";
  }
  const row = { ...values, image_url: imageUrl };
  let result = id
    ? await client
        .from("barangays")
        .update(row)
        .eq("id", id)
        .eq("updated_at", String(form.get("updated_at")))
        .select("id")
    : await client.from("barangays").insert(row).select("id");
  if (
    !id &&
    result.error?.code === "23505" &&
    result.error.message.includes("barangays_slug_key")
  ) {
    // Concurrent creates or names that normalize alike get a unique address.
    result = await client
      .from("barangays")
      .insert({
        ...row,
        slug: `${row.slug}-${crypto.randomUUID().slice(0, 8)}`,
      })
      .select("id");
  }
  if ((result.error || !result.data?.length) && uploaded)
    await client.storage.from("municipal-media").remove([uploaded.path]);
  if (result.error) {
    if (["42P01", "PGRST205"].includes(result.error.code))
      return "Apply migration 028 before managing barangays.";
    if (result.error.code === "23505")
      return "Unable to create a unique page address. Please try saving again.";
    if (result.error.code === "42501")
      return "Active Superadmin access is required to save barangays.";
    return "Unable to save the barangay. Check the details and try again.";
  }
  if (!result.data?.length)
    return "This barangay changed. Reload before saving.";
  revalidatePath("/", "layout");
  redirect("/superadmin/barangays?saved=1");
}
