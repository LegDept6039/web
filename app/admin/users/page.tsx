import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
export default async function UsersRedirect() {
  await requireStaff(true);
  redirect("/superadmin/users");
}
