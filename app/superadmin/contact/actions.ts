"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
import { validateContactSettings } from "@/lib/municipal-contact/validation";

export async function saveMunicipalContact(
  _message: string,
  form: FormData,
): Promise<string> {
  const { client } = await requireStaff(true, true);
  let values: ReturnType<typeof validateContactSettings>;
  try {
    values = validateContactSettings(Object.fromEntries(form));
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Check the contact details and try again.";
  }
  const updatedAt = String(form.get("updated_at") || "");
  if (!updatedAt || !Number.isFinite(Date.parse(updatedAt)))
    return "Reload this page before saving the contact details.";

  const { data, error } = await client
    .from("municipal_contact_settings")
    .update(values)
    .eq("id", "municipal")
    .eq("updated_at", updatedAt)
    .select("id");

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205")
      return "Contact settings are not installed yet. Apply migration 023, then reload this page.";
    if (error.code === "42501")
      return "Superadmin access is required to update municipal contact details.";
    return "Unable to save the contact details. Please try again.";
  }
  if (!data?.length)
    return "These contact details changed since you opened this page. Reload before saving.";

  revalidatePath("/contact");
  revalidatePath("/superadmin/contact");
  redirect("/superadmin/contact?saved=1");
}
