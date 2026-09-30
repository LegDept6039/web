import Link from "next/link";
import { requireStaff } from "@/lib/auth/server";
import { logout } from "@/app/login/actions";
import "../staff.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff(true);
  return (
    <section className="section container">
      <nav className="staff-nav" aria-label="Administration">
        <Link href="/admin">Overview</Link>
        <Link href="/admin/users">Staff accounts</Link>
        <Link href="/account">My account</Link>
        <form action={logout}>
          <button className="button">Sign out</button>
        </form>
      </nav>
      {children}
    </section>
  );
}
