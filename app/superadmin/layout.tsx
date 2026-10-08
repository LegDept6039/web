import { AdminShell } from "@/components/admin/AdminShell";
import { requireStaff } from "@/lib/auth/server";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Super Admin",
  robots: { index: false, follow: false },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff(true);
  return <AdminShell superadmin>{children}</AdminShell>;
}
