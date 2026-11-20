"use server";
import { currentStaff, authenticatedStaffState } from "@/lib/auth/server";
import { staffSession } from "@/lib/auth/staff-session";
import { STAFF_SESSION_COOKIE, validTabToken } from "@/lib/auth/session-policy";
import { cookies } from "next/headers";
export async function checkStaffSession(token: string, activity = false) {
  if (
    !validTabToken(token) ||
    token !== (await cookies()).get(STAFF_SESSION_COOKIE)?.value
  )
    return null;
  const state = await authenticatedStaffState(true);
  if (state?.passwordStatus.required) return { passwordReset: true as const };
  const staff = await currentStaff(true);
  if (!staff) return null;
  const session = await staffSession(staff.client, activity);
  return session ? { remainingMs: session.remainingMs } : null;
}
