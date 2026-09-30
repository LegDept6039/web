import Link from "next/link";
import { requireStaff } from "@/lib/auth/server";
import { logout } from "@/app/login/actions";
import "../staff.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Staff account",
  robots: { index: false, follow: false },
};
export default async function AccountPage() {
  const { profile } = await requireStaff();
  return (
    <section className="section container">
      <div className="staff-card">
        <p className="eyebrow">Staff portal</p>
        <h1>Your account</h1>
        <p>Welcome, {profile.display_name || profile.email}.</p>
        <p>
          Role:{" "}
          <strong>
            {profile.role === "superadmin" ? "Superadmin" : "User"}
          </strong>
        </p>
        {profile.role === "superadmin" ? (
          <Link className="button button-blue" href="/admin">
            Open administration
          </Link>
        ) : (
          <p>
            Your account is active. Content editing is reserved for superadmins.
          </p>
        )}
        <form action={logout}>
          <button className="button" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
