"use server";
import { requireStaff } from "@/lib/auth/server";
import { passwordInput } from "@/lib/admin/users";
import { randomUUID } from "node:crypto";
import { authAdminClient } from "@/lib/auth/admin";
import {
  passwordResetStatus,
  clearResetProof,
  failRejectedReset,
} from "@/lib/auth/password-reset";
import { cookies } from "next/headers";
import { STAFF_SESSION_COOKIE } from "@/lib/auth/session-policy";
import { staffCookieOptions } from "@/lib/auth/staff-session";
import { redirect } from "next/navigation";
export async function changePassword(
  _state: string,
  form: FormData,
): Promise<string> {
  const { client, user } = await requireStaff(false, true);
  let password: string;
  try {
    password = passwordInput(form);
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Check the password fields.";
  }
  try {
    const current = String(form.get("current_password") || "");
    if (!current || current.length > 1024 || !user.email)
      return "Enter your current password.";
    if (password === current)
      return "Choose a different password from your current password.";
    const { error: verifyError } = await client.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (verifyError) return "Current password is incorrect.";
    const status = await passwordResetStatus(client);
    if (!status.ready || status.required || !status.session_id)
      return "A password reset is required. Sign out and use the temporary password from the Superadmin.";
    const admin = authAdminClient();
    const generation = randomUUID();
    const { data: claimed, error: claimError } = await admin.rpc(
      "begin_staff_password_update",
      {
        p_user_id: user.id,
        p_session_id: status.session_id,
        p_generation: generation,
        p_password_hash: null,
      },
    );
    if (claimError || claimed !== true)
      return "Another password operation is in progress. Please sign out and contact the Superadmin.";
    const { data: session } = await client.auth.getSession();
    if (!session.session?.access_token)
      return "Password change could not be finalized. Contact the Superadmin.";
    const { error: revokeError } = await admin.auth.admin.signOut(
      session.session.access_token,
      "global",
    );
    if (revokeError)
      return "Session revocation could not be confirmed. Contact the Superadmin.";
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
    });
    if (error) {
      await failRejectedReset(user.id, generation, error);
      return "The password could not be changed. Contact the Superadmin before retrying.";
    }
    const { data: finished, error: finishError } = await admin.rpc(
      "finish_staff_password_change",
      { p_user_id: user.id, p_generation: generation },
    );
    if (finishError || finished !== true)
      return "Password change could not be finalized. Contact the Superadmin.";
    await client.auth.signOut({ scope: "local" });
    await clearResetProof();
    (await cookies()).set(STAFF_SESSION_COOKIE, "", {
      ...staffCookieOptions,
      maxAge: 0,
    });
  } catch {
    return "Password change could not be confirmed. Contact the Superadmin before retrying.";
  }
  redirect("/login?password=updated");
}
