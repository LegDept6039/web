import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
export default async function Page() {
  await requireStaff(true);
  redirect("/admin/transparency");
}
