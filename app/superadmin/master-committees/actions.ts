"use server";
import { requireStaff } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
export async function saveMasterCommittee(
  _state: string,
  form: FormData,
): Promise<string> {
  const { client } = await requireStaff(true, true);
  const id = String(form.get("id") || "");
  const name = String(form.get("name") || "").trim();
  const sort_order = Number(form.get("sort_order"));
  if (!name || name.length > 300)
    return "Enter a committee name of up to 300 characters.";
  if (!Number.isInteger(sort_order) || sort_order < 0 || sort_order > 1000000)
    return "Enter a display order between 0 and 1000000.";
  const result = id
    ? await client
        .from("committee_master")
        .update({ name, sort_order })
        .eq("id", id)
        .eq("updated_at", String(form.get("updated_at")))
        .select("id")
    : await client
        .from("committee_master")
        .insert({ name, sort_order })
        .select("id");
  if (result.error)
    return result.error.code === "23505"
      ? "That exact committee name already exists."
      : "Unable to save the master committee. Check your access and try again.";
  if (!result.data?.length)
    return "This committee changed. Reload before saving.";
  revalidatePath("/", "layout");
  redirect("/superadmin/master-committees?saved=1");
}
