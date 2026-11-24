"use server";
import {
  passwordResetStatus,
  resetRecord,
  setResetProof,
  clearResetProof,
  RESET_EXPIRED_MESSAGE,
} from "@/lib/auth/password-reset";
import { equalDigest, passwordDigest } from "@/lib/auth/password-reset-crypto";
import { sessionHash, staffCookieOptions } from "@/lib/auth/staff-session";
import { STAFF_SESSION_COOKIE, validTabToken } from "@/lib/auth/session-policy";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth/server";
import { cookies } from "next/headers";
import { authConfig } from "@/lib/auth/config";
import { resolveStaff } from "@/lib/auth/resolve-staff";
import { normalizeUsername } from "@/lib/auth/username";
import { usernameIdentity } from "@/lib/auth/username-server";
import {
  authDiagnostic,
  errorCode,
  passwordError,
} from "@/lib/auth/diagnostics";

export async function login(
  _previous: string,
  form: FormData,
): Promise<string> {
  const tabToken = String(form.get("tab_token") || "");
  if (!validTabToken(tabToken))
    return "Enable browser storage and JavaScript, then try signing in again.";
  let username: string;
  try {
    username = normalizeUsername(form.get("username"));
  } catch {
    return "Enter your username and password.";
  }
  const password = String(form.get("password") ?? "");
  if (!password || password.length > 1024)
    return "Enter your username and password.";
  let destination = "/admin";
  try {
    const client = await authClient(true);
    if (!client) return "Staff login has not been configured yet.";
    const identity = await usernameIdentity(username);
    // Unknown names still use the password endpoint and its rate limiting.
    // No internal Auth identifier is returned to the browser.
    const { data, error } = await client.auth.signInWithPassword({
      email: identity?.email || "unknown-staff@staff.pinamungajan.invalid",
      password,
    });
    if (error || !data.user || !data.session) {
      authDiagnostic("password", {
        outcome: "auth_error",
        code: errorCode(error),
        status: error?.status,
        sessionPresent: !!data.session,
      });
      return error
        ? passwordError(error)
        : "Unable to sign in. The authentication service returned no session.";
    }
    if (!identity || data.user.id !== identity.userId) {
      await client.auth.signOut({ scope: "local" });
      return "Unable to sign in. Invalid username or password.";
    }
    authDiagnostic("password", {
      outcome: "ok",
      userId: data.user.id,
      sessionPresent: true,
    });
    const reset = await passwordResetStatus(client);
    if (reset.required) {
      const { data: profile } = await client
        .from("staff_accounts")
        .select("active,deleted_at")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (!profile?.active || profile.deleted_at) {
        await client.auth.signOut({ scope: "local" });
        return "Your staff account is inactive or removed. Contact your administrator.";
      }
      const record = await resetRecord(data.user.id);
      if (record?.expires_at && Date.parse(record.expires_at) <= Date.now()) {
        await client.auth.signOut({ scope: "local" });
        await clearResetProof();
        return RESET_EXPIRED_MESSAGE;
      }
      if (
        !record ||
        record.state !== "pending" ||
        record.generation !== reset.generation ||
        !reset.session_id ||
        !equalDigest(passwordDigest(password), record.temp_password_hash)
      ) {
        await client.auth.signOut({ scope: "local" });
        await clearResetProof();
        return "This temporary password is no longer valid. Contact the Superadmin for a new one.";
      }
      await setResetProof({
        userId: data.user.id,
        generation: record.generation,
        sessionId: reset.session_id,
        expiresAt: record.expires_at,
      });
      destination = "/change-password";
    } else {
      await clearResetProof();
      const resolved = await resolveStaff(client, data.user.id);
      if (!resolved.ok) {
        try {
          await client.auth.signOut({ scope: "local" });
        } catch {
          authDiagnostic("signout", { outcome: "cleanup_error" });
        }
        return resolved.message;
      }
      if (!reset.ready) {
        await client.auth.signOut({ scope: "local" });
        return "Your session is no longer valid. Please sign in again.";
      }
      const { data: started, error: sessionError } = await client.rpc(
        "start_staff_session",
        { p_hash: sessionHash(tabToken) },
      );
      if (sessionError || started !== true) {
        await client.auth.signOut({ scope: "local" });
        return "Staff session protection is unavailable. Ask your administrator to verify migration 013.";
      }
      (await cookies()).set(STAFF_SESSION_COOKIE, tabToken, staffCookieOptions);
      destination =
        resolved.profile.role === "superadmin" ? "/superadmin" : "/admin";
    }
  } catch (error) {
    authDiagnostic("login", {
      outcome: "service_error",
      code: errorCode(error),
    });
    return "The sign-in service is unavailable. Please try again later.";
  }
  redirect(destination);
}

export async function logout() {
  const config = authConfig();
  try {
    const client = await authClient(true);
    const token = (await cookies()).get(STAFF_SESSION_COOKIE)?.value || "";
    if (client && validTabToken(token))
      await client.rpc("end_staff_session", { p_hash: sessionHash(token) });
    await client?.auth.signOut({ scope: "local" });
  } catch {
    // Clear this browser's session even when the Auth service is unreachable.
  } finally {
    await clearResetProof();
    (await cookies()).set(STAFF_SESSION_COOKIE, "", {
      ...staffCookieOptions,
      maxAge: 0,
    });
    if (config) {
      const prefix = `sb-${new URL(config.url).hostname.split(".")[0]}-auth-token`;
      const jar = await cookies();
      for (const cookie of jar.getAll()) {
        if (cookie.name === prefix || cookie.name.startsWith(`${prefix}.`)) {
          jar.set(cookie.name, "", {
            path: "/",
            maxAge: 0,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
          });
        }
      }
    }
  }
  redirect("/login");
}
