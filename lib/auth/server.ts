import "server-only";
import { staffSession } from "./staff-session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authConfig } from "./config";
import { resolveStaff } from "./resolve-staff";
import { authDiagnostic, errorCode } from "./diagnostics";

export async function authClient(writable = false) {
  const config = authConfig();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        // Proxy refreshes render-time sessions; actions may write cookies.
        if (writable)
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
      },
    },
  });
}

export async function currentStaff(writable = false) {
  const client = await authClient(writable);
  if (!client) return null;
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    if (error && error.name !== "AuthSessionMissingError")
      authDiagnostic("session", {
        outcome: "auth_error",
        code: errorCode(error),
        status: error.status,
      });
    return null;
  }
  if (!(await staffSession(client))) return null;
  const resolved = await resolveStaff(client, user.id);
  if (!resolved.ok) return null;
  return { client, user, profile: resolved.profile };
}

export async function requireStaff(superadmin = false, writable = false) {
  const staff = await currentStaff(writable);
  if (!staff) redirect("/login");
  if (superadmin && staff.profile.role !== "superadmin") redirect("/admin");
  return staff;
}
