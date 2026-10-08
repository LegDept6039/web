"use server";
import { requireStaff } from "@/lib/auth/server";
import { passwordInput } from "@/lib/admin/users";
export async function changePassword(
  _state: string,
  form: FormData,
): Promise<string> {
  const { client, user } = await requireStaff(false, true);
  try {
    const password = passwordInput(form);
    const current = String(form.get("current_password") || "");
    if (!current || current.length > 1024 || !user.email)
      return "Enter your current password.";
    const { error: verifyError } = await client.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (verifyError) return "Current password is incorrect.";
    const { error } = await client.auth.updateUser({ password });
    return error
      ? "Unable to change password. Check the password policy."
      : "Password updated.";
  } catch (e) {
    return e instanceof Error ? e.message : "Unable to change password.";
  }
}
