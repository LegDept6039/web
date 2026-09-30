"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/server";
export async function updateStaff(
  _state: string,
  form: FormData,
): Promise<string> {
  const { client, user } = await requireStaff(true, true);
  const id = String(form.get("user_id"));
  const role = String(form.get("role"));
  const active = form.get("active") === "on";
  const name = String(form.get("display_name") || "").trim();
  if (!["user", "superadmin"].includes(role) || name.length > 120)
    return "Check the account settings.";
  if (id === user.id && (!active || role !== "superadmin"))
    return "You cannot remove your own superadmin access.";
  const { error } = await client.rpc("set_staff_access", {
    p_user_id: id,
    p_role: role,
    p_active: active,
    p_display_name: name,
  });
  if (error)
    return "Unable to update this account. Reload and check your access.";
  revalidatePath("/admin/users");
  return "Account updated.";
}
