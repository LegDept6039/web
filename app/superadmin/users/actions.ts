"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/server";
import { authAdminClient } from "@/lib/auth/admin";
import { parseUser, passwordInput } from "@/lib/admin/users";
export async function saveUser(
  _state: string,
  form: FormData,
): Promise<string> {
  const { client } = await requireStaff(true, true);
  let values: ReturnType<typeof parseUser>;
  try {
    values = parseUser(form);
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid account details.";
  }
  const id = String(form.get("user_id") || "");
  const deleting = form.get("delete") === "on";
  if (deleting && form.get("confirm_delete") !== "on")
    return "Confirm account deletion first.";
  let createdId: string | undefined;
  if (!id) {
    if (deleting) return "Invalid account.";
    const email = String(form.get("email") || "").trim();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "Enter a valid email address.";
    try {
      const password = passwordInput(form);
      const admin = authAdminClient();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: values.name },
      });
      if (error || !data.user)
        return "Could not create account. Check the email, password policy, and server configuration. The email may already be registered.";
      createdId = data.user.id;
    } catch (e) {
      return e instanceof Error && e.message.startsWith("Server account")
        ? e.message
        : e instanceof Error && e.message.startsWith("Use a password")
          ? e.message
          : "Passwords must match and account management must be configured.";
    }
  }
  let failed = false;
  try {
    const { error } = await client.rpc("manage_staff", {
      p_user_id: id || createdId,
      p_role: values.role,
      p_active: values.active,
      p_display_name: values.name,
      p_access: values.access,
      p_delete: deleting,
      p_transparency_access: values.transparencyAccess,
    });
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  if (failed) {
    if (createdId) {
      try {
        const { error } =
          await authAdminClient().auth.admin.deleteUser(createdId);
        if (error) throw new Error("cleanup");
      } catch {
        return "Account creation or access setup could not be confirmed. Review the account in Users before retrying.";
      }
    }
    return "Could not save access. Check office assignments and your permissions. You cannot remove your own Super Admin access.";
  }
  revalidatePath("/superadmin", "layout");
  revalidatePath("/admin", "layout");
  redirect("/superadmin/users");
}
export async function resetPassword(
  _state: string,
  form: FormData,
): Promise<string> {
  const { client } = await requireStaff(true, true);
  const id = String(form.get("user_id") || "");
  const { data: target, error } = await client
    .from("staff_accounts")
    .select("user_id")
    .eq("user_id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !target) return "Account not found.";
  try {
    const password = passwordInput(form);
    const admin = authAdminClient();
    const { error: resetError } = await admin.auth.admin.updateUserById(id, {
      password,
    });
    if (resetError)
      return "Could not reset password. Check the password policy and server configuration.";
    const { error: auditError } = await client.rpc("audit_password_reset", {
      p_user_id: id,
    });
    return auditError
      ? "Password changed, but audit logging failed. Check database configuration."
      : "Password reset. Share the new password privately with the account holder.";
  } catch (e) {
    return e instanceof Error ? e.message : "Unable to reset password.";
  }
}
