import { AdminShell } from "@/components/admin/AdminShell";
import { requireStaff } from "@/lib/auth/server";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff();
  return <AdminShell>{children}</AdminShell>;
}
