"use server";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth/server";
import { cookies } from "next/headers";
import { authConfig } from "@/lib/auth/config";
import { resolveStaff } from "@/lib/auth/resolve-staff";
import {
  authDiagnostic,
  errorCode,
  passwordError,
} from "@/lib/auth/diagnostics";

export async function login(
  _previous: string,
  form: FormData,
): Promise<string> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || email.length > 254 || !password || password.length > 1024)
    return "Enter your email and password.";
  let destination = "/admin";
  try {
    const client = await authClient(true);
    if (!client) return "Staff login has not been configured yet.";
    const { data, error } = await client.auth.signInWithPassword({
      email,
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
    authDiagnostic("password", {
      outcome: "ok",
      userId: data.user.id,
      sessionPresent: true,
    });
    const resolved = await resolveStaff(client, data.user.id);
    if (!resolved.ok) {
      try {
        await client.auth.signOut({ scope: "local" });
      } catch {
        authDiagnostic("signout", { outcome: "cleanup_error" });
      }
      return resolved.message;
    }
    destination =
      resolved.profile.role === "superadmin" ? "/superadmin" : "/admin";
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
    await client?.auth.signOut({ scope: "local" });
  } catch {
    // Clear this browser's session even when the Auth service is unreachable.
  } finally {
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
