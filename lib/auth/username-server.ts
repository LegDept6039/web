import "server-only";
import { authAdminClient } from "./admin";
import { normalizeUsername } from "./username";

/** This mapping is private. Only a verified password grants a staff session. */
export async function usernameIdentity(input: string) {
  const username = normalizeUsername(input);
  const { data, error } = await authAdminClient()
    .from("staff_accounts")
    .select("user_id,username,email")
    .eq("username", username)
    .maybeSingle();
  if (error) throw new Error("Staff sign-in lookup is unavailable.");
  if (!data) return null;
  if (
    data.username !== username ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      data.user_id,
    ) ||
    typeof data.email !== "string" ||
    !data.email ||
    data.email.length > 254
  )
    throw new Error("Staff sign-in lookup is unavailable.");
  return { userId: data.user_id as string, email: data.email };
}
