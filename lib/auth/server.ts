import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readContentConfig } from "@/lib/content/config";

export async function authClient(writable = false) {
  const config = readContentConfig(process.env);
  if (config.source !== "supabase") return null;
  const jar = await cookies();
  return createServerClient(config.supabase.url, config.supabase.key, {
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
  if (error || !user) return null;
  const { data: profile, error: profileError } = await client
    .from("staff_accounts")
    .select("user_id,email,display_name,role,active")
    .eq("user_id", user.id)
    .single();
  if (
    profileError ||
    !profile ||
    !profile.active ||
    !["user", "superadmin"].includes(profile.role)
  )
    return null;
  return { client, user, profile };
}

export async function requireStaff(superadmin = false, writable = false) {
  const staff = await currentStaff(writable);
  if (!staff) redirect("/login");
  if (superadmin && staff.profile.role !== "superadmin") redirect("/account");
  return staff;
}
