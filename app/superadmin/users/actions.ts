"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/server";
import { authAdminClient } from "@/lib/auth/admin";
import { parseUser, passwordInput } from "@/lib/admin/users";
import { randomUUID } from "node:crypto";
import {
  temporaryPassword,
  passwordDigest,
} from "@/lib/auth/password-reset-crypto";
import {
  passwordResetStatus,
  resetRecord,
  failRejectedReset,
} from "@/lib/auth/password-reset";
import type { ResetPasswordResult } from "@/lib/auth/password-reset-types";
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
    try {
      const password = passwordInput(form);
      const admin = authAdminClient();
      const { data, error } = await admin.auth.admin.createUser({
        email: `${randomUUID()}@staff.pinamungajan.invalid`,
        password,
        email_confirm: true,
        user_metadata: { full_name: values.name },
      });
      if (error || !data.user)
        return "Could not create account. Check the password policy and server configuration.";
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
  let duplicateUsername = false;
  try {
    const { error } = await client.rpc("manage_staff_account", {
      p_user_id: id || createdId,
      p_role: values.role,
      p_active: values.active,
      p_display_name: values.name,
      p_username: values.username,
      p_access: values.access,
      p_delete: deleting,
      p_transparency_access: values.transparencyAccess,
    });
    failed = Boolean(error);
    duplicateUsername = error?.code === "23505";
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
    if (duplicateUsername) return "That username is already in use.";
    return "Could not save access. Check office assignments and your permissions. You cannot remove your own Super Admin access.";
  }
  revalidatePath("/superadmin", "layout");
  revalidatePath("/admin", "layout");
  redirect("/superadmin/users");
}
export async function resetPassword(
  _state: ResetPasswordResult,
  form: FormData,
): Promise<ResetPasswordResult> {
  const { client, user } = await requireStaff(true, true);
  const id = String(form.get("user_id") || "");
  if (form.get("confirm_reset") !== "on")
    return {
      message:
        "Verify the staff member’s identity and confirm the account before resetting.",
    };
  if (id === user.id)
    return {
      message:
        "Use Change password in your account to update your own password.",
    };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { message: "Account not found." };
  const { data: target, error } = await client
    .from("staff_accounts")
    .select("user_id,active")
    .eq("user_id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !target) return { message: "Account not found." };
  if (!target.active)
    return {
      message: "This account is disabled. A password reset cannot enable it.",
    };
  const generation = randomUUID();
  try {
    const password = temporaryPassword();
    const admin = authAdminClient();
    const status = await passwordResetStatus(client);
    const { data: started, error: startError } = await admin.rpc(
      "begin_staff_password_reset",
      {
        p_actor: user.id,
        p_actor_session: status.session_id,
        p_user_id: id,
        p_generation: generation,
        p_password_hash: passwordDigest(password),
      },
    );
    if (startError || started !== true)
      return {
        message:
          "Could not start the reset. Check account access or whether another password operation is still running.",
      };
    const { error: resetError } = await admin.auth.admin.updateUserById(id, {
      password,
    });
    if (resetError) {
      await failRejectedReset(id, generation, resetError);
      return {
        message:
          "The temporary password could not be issued. The account remains restricted. Ask the system administrator to review the reset before retrying.",
      };
    }
    const { data: activated, error: activateError } = await admin.rpc(
      "activate_staff_password_reset",
      {
        p_user_id: id,
        p_generation: generation,
      },
    );
    const record =
      !activateError && activated === true ? await resetRecord(id) : null;
    if (
      !record ||
      record.generation !== generation ||
      record.state !== "pending"
    )
      return {
        message:
          "Reset activation could not be confirmed. The account remains restricted. Ask the system administrator to review it.",
      };
    return {
      message:
        "Temporary password created. Share it privately with the account holder. It is shown only here and expires in 30 minutes.",
      temporaryPassword: password,
      expiresAt: record.expires_at,
    };
  } catch {
    return {
      message:
        "Password reset could not be confirmed. Check server configuration and reset status before retrying.",
    };
  }
}
