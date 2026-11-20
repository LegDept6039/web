import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authAdminClient } from "./admin";
import {
  signResetProof,
  verifyResetProof,
  type ResetProof,
} from "./password-reset-crypto";
import type { PasswordResetStatus } from "./password-reset-types";
import { staffCookieOptions } from "./staff-session";

export const RESET_PROOF_COOKIE = "portal-password-reset";
export const RESET_EXPIRED_MESSAGE =
  "Your temporary password has expired. Contact the Superadmin for a new one.";

export function resetIsExpired(expiresAt: string | null | undefined) {
  return Boolean(expiresAt && Date.parse(expiresAt) <= Date.now());
}

export async function passwordResetStatus(
  client: SupabaseClient,
): Promise<PasswordResetStatus> {
  const { data, error } = await client.rpc("password_reset_status");
  if (
    error ||
    !data ||
    typeof data.required !== "boolean" ||
    typeof data.ready !== "boolean"
  )
    throw new Error(
      "Password reset protection is unavailable. Ask the Superadmin to verify migration 026.",
    );
  return data as PasswordResetStatus;
}

export async function resetRecord(userId: string) {
  const { data, error } = await authAdminClient()
    .from("staff_password_resets")
    .select("user_id,generation,state,expires_at,temp_password_hash")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Password reset protection is unavailable.");
  return data as {
    user_id: string;
    generation: string;
    state: string;
    expires_at: string;
    temp_password_hash: string;
  } | null;
}

function proofSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error("Server account management is not configured.");
  return secret;
}

export async function setResetProof(proof: ResetProof) {
  (await cookies()).set(
    RESET_PROOF_COOKIE,
    signResetProof(proof, proofSecret()),
    {
      ...staffCookieOptions,
      expires: new Date(proof.expiresAt),
    },
  );
}
export async function clearResetProof() {
  (await cookies()).set(RESET_PROOF_COOKIE, "", {
    ...staffCookieOptions,
    maxAge: 0,
  });
}
export async function hasResetProof(
  userId: string,
  status: PasswordResetStatus,
) {
  const value = (await cookies()).get(RESET_PROOF_COOKIE)?.value;
  if (!value) return false;
  const proof = verifyResetProof(value, proofSecret());
  return Boolean(
    proof &&
    proof.userId === userId &&
    proof.generation === status.generation &&
    proof.sessionId === status.session_id &&
    Date.parse(proof.expiresAt) === Date.parse(status.expires_at || "") &&
    Date.parse(proof.expiresAt) > Date.now(),
  );
}

/** Only a definite Auth rejection is safe to release; ambiguous writes stay locked. */
export async function failRejectedReset(
  userId: string,
  generation: string,
  error: { status?: number; name?: string },
) {
  if (
    error.name === "AuthApiError" &&
    error.status &&
    error.status >= 400 &&
    error.status < 500
  )
    await authAdminClient().rpc("fail_staff_password_reset", {
      p_user_id: userId,
      p_generation: generation,
    });
}
