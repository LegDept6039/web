import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STAFF_SESSION_COOKIE, validTabToken } from "./session-policy";
export const sessionHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const staffCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
export async function staffSession(client: SupabaseClient, touch = false) {
  const token = (await cookies()).get(STAFF_SESSION_COOKIE)?.value || "";
  if (!validTabToken(token)) return null;
  const { data, error } = await client.rpc("staff_session_deadline", {
    p_hash: sessionHash(token),
    p_touch: touch,
  });
  if (error || typeof data !== "number" || data <= 0) return null;
  return { remainingMs: data, token };
}
