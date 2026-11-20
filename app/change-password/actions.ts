"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { authenticatedStaffState } from "@/lib/auth/server";
import { authAdminClient } from "@/lib/auth/admin";
import { passwordInput } from "@/lib/admin/users";
import {
  hasResetProof,
  resetRecord,
  clearResetProof,
  RESET_EXPIRED_MESSAGE,
  failRejectedReset,
} from "@/lib/auth/password-reset";
import { equalDigest, passwordDigest } from "@/lib/auth/password-reset-crypto";
import { STAFF_SESSION_COOKIE } from "@/lib/auth/session-policy";
import { staffCookieOptions } from "@/lib/auth/staff-session";

export async function changeRequiredPassword(
  _state: string,
  form: FormData,
): Promise<string> {
  const staff = await authenticatedStaffState(true);
  if (!staff) redirect("/login");
  const { client, user, passwordStatus: status } = staff;
  if (!status.required) redirect("/login");
  if (status.expires_at && Date.parse(status.expires_at) <= Date.now())
    return RESET_EXPIRED_MESSAGE;
  if (
    status.state !== "pending" ||
    !status.generation ||
    !status.session_id ||
    !(await hasResetProof(user.id, status))
  )
    return "Sign out and sign in with the latest temporary password. If it no longer works, contact the Superadmin.";
  let password: string;
  try {
    password = passwordInput(form);
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Check the password fields.";
  }
  try {
    const record = await resetRecord(user.id);
    if (!record || record.generation !== status.generation)
      return "This reset has been replaced. Contact the Superadmin for the latest temporary password.";
    if (equalDigest(passwordDigest(password), record.temp_password_hash))
      return "Choose a different password from your temporary password.";
    const admin = authAdminClient();
    const { data: claimed, error: claimError } = await admin.rpc(
      "claim_staff_password_change",
      {
        p_user_id: user.id,
        p_generation: status.generation,
        p_session_id: status.session_id,
      },
    );
    if (claimError || claimed !== true)
      return "This reset expired, was replaced, or is already being used. Contact the Superadmin for assistance.";
    // Revoke while this JWT still has a live Auth session. Admin password updates
    // also revoke sessions, so doing this afterward can fail on a revoked JWT.
    const { data: session } = await client.auth.getSession();
    if (!session.session?.access_token)
      return "Password change could not be finalized. Contact the Superadmin.";
    const { error: revokeError } = await admin.auth.admin.signOut(
      session.session.access_token,
      "global",
    );
    if (revokeError)
      return "Session revocation could not be confirmed. Your account remains restricted. Contact the Superadmin.";
    const { error: updateError } = await admin.auth.admin.updateUserById(
      user.id,
      { password },
    );
    if (updateError) {
      await failRejectedReset(user.id, status.generation, updateError);
      return "The password could not be changed. Your account remains restricted. Contact the Superadmin for a new temporary password.";
    }
    const { data: finished, error: finishError } = await admin.rpc(
      "finish_staff_password_change",
      { p_user_id: user.id, p_generation: status.generation },
    );
    if (finishError || finished !== true)
      return "Password change could not be finalized. Your account remains restricted. Contact the Superadmin.";
    await client.auth.signOut({ scope: "local" });
    await clearResetProof();
    (await cookies()).set(STAFF_SESSION_COOKIE, "", {
      ...staffCookieOptions,
      maxAge: 0,
    });
  } catch {
    return "Password change could not be confirmed. Your account remains restricted. Contact the Superadmin before retrying.";
  }
  redirect("/login?password=updated");
}
