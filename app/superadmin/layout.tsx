import { Suspense } from "react";
import { AdminSkeleton } from "@/components/shared/PageSkeleton";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireStaff } from "@/lib/auth/server";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Super Admin",
  robots: { index: false, follow: false },
};
async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireStaff(true);
  return <AdminShell superadmin>{children}</AdminShell>;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AdminSkeleton shell />}>
      <ProtectedLayout>{children}</ProtectedLayout>
    </Suspense>
  );
}
