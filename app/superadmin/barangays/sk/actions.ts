"use server";
import { requireStaff } from "@/lib/auth/server";
import { uploadOfficialPhoto } from "@/lib/admin/photo";
import { uploadFile } from "@/lib/admin/upload-file";
import { prepareSKValues } from "@/lib/sk/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveSKProfile(
  _state: string,
  form: FormData,
): Promise<string> {
  const { client, user } = await requireStaff(true, true);
  const id = String(form.get("id") || "");
  let storedSlug: string | undefined;
  let imageUrl: string | null = null;
  if (id) {
    const { data, error } = await client
      .from("sk_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data || typeof data.slug !== "string" || !data.slug)
      return "This SK profile is unavailable. Reload the list and try again.";
    if (data.updated_at !== String(form.get("updated_at")))
      return "This SK profile changed since you opened it. Reload before saving.";
    storedSlug = data.slug;
    imageUrl = form.get("remove_image") === "on" ? null : data.image_url;
  }
  const barangayId = String(form.get("barangay_id") || "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      barangayId,
    )
  )
    return "Choose a barangay.";
  const { data: barangay, error: barangayError } = await client
    .from("barangays")
    .select("id,name,published")
    .eq("id", barangayId)
    .maybeSingle();
  if (barangayError || !barangay)
    return "This barangay is unavailable. Reload and choose a barangay.";
  let values: ReturnType<typeof prepareSKValues>;
  try {
    values = prepareSKValues(
      { ...Object.fromEntries(form), barangay_id: barangayId },
      barangay.name,
      storedSlug,
    );
  } catch (error) {
    return error instanceof Error ? error.message : "Check the SK details.";
  }
  if (values.published && !barangay.published)
    return "Publish the linked barangay before publishing its SK profile.";
  let uploaded: Awaited<ReturnType<typeof uploadOfficialPhoto>> | undefined;
  try {
    const file = uploadFile(form, "image");
    if (file) {
      uploaded = await uploadOfficialPhoto(client, user.id, file, "sk");
      imageUrl = uploaded.url;
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Image upload failed.";
  }
  const row = { ...values, image_url: imageUrl };
  let result = id
    ? await client
        .from("sk_profiles")
        .update(row)
        .eq("id", id)
        .eq("updated_at", String(form.get("updated_at")))
        .select("id")
    : await client.from("sk_profiles").insert(row).select("id");
  if (
    !id &&
    result.error?.code === "23505" &&
    result.error.message.includes("sk_profiles_slug_key")
  ) {
    result = await client
      .from("sk_profiles")
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
      return "Apply migration 029 after 028 before managing SK profiles.";
    if (result.error.code === "23505")
      return result.error.message.includes("sk_profiles_barangay_id_key")
        ? "This barangay already has an SK profile. Edit its existing profile instead."
        : "Unable to create a unique page address. Please try saving again.";
    if (result.error.code === "23503")
      return "This barangay is unavailable. Reload and try again.";
    if (result.error.code === "42501")
      return "Active Superadmin access is required to save SK profiles.";
    return "Unable to save the SK profile. Check the details and try again.";
  }
  if (!result.data?.length)
    return "This SK profile changed. Reload before saving.";
  revalidatePath("/", "layout");
  redirect("/superadmin/barangays/sk?saved=1");
}
