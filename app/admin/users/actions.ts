"use server";
import { requireStaff } from "@/lib/auth/server";
export async function updateStaff(): Promise<string> {
  await requireStaff(true, true);
  return "Use the updated Users & access control screen at /superadmin/users.";
}
