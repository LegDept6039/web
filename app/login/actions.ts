"use server";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth/server";
import { cookies } from "next/headers";
import { readContentConfig } from "@/lib/content/config";

export async function login(
  _previous: string,
  form: FormData,
): Promise<string> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || email.length > 254 || !password || password.length > 1024)
    return "Enter your email and password.";
  let destination = "/account";
  try {
    const client = await authClient(true);
    if (!client) return "Staff login has not been configured yet.";
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user)
      return "Unable to sign in. Check your credentials or try again later.";
    const { data: profile, error: profileError } = await client
      .from("staff_accounts")
      .select("role,active")
      .eq("user_id", data.user.id)
      .single();
    if (
      profileError ||
      !profile?.active ||
      !["user", "superadmin"].includes(profile.role)
    ) {
      await client.auth.signOut({ scope: "local" });
      return "Your staff access is not enabled. Contact your administrator.";
    }
    destination = profile.role === "superadmin" ? "/admin" : "/account";
  } catch {
    return "The sign-in service is unavailable. Please try again later.";
  }
  redirect(destination);
}

export async function logout() {
  const config = readContentConfig(process.env);
  try {
    const client = await authClient(true);
    await client?.auth.signOut({ scope: "local" });
  } catch {
    // Clear this browser's session even when the Auth service is unreachable.
  } finally {
    if (config.source === "supabase") {
      const prefix = `sb-${new URL(config.supabase.url).hostname.split(".")[0]}-auth-token`;
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
