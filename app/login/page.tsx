import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/auth/server";
import { authConfig } from "@/lib/auth/config";
import { LoginForm } from "./LoginForm";
import "../staff.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const staff = await currentStaff(false, true);
  if (staff)
    redirect(staff.profile.role === "superadmin" ? "/superadmin" : "/admin");
  const updated = (await searchParams).password === "updated";
  return (
    <section className="section container">
      <div className="staff-login staff-card">
        <p className="eyebrow">Municipality of Pinamungajan</p>
        <h1>Staff sign in</h1>
        <p>Access your municipal staff account.</p>
        {updated && (
          <p role="status">
            Password updated. Please sign in with your new password.
          </p>
        )}
        <LoginForm enabled={Boolean(authConfig())} />
      </div>
    </section>
  );
}
