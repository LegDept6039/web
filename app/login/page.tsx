import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/auth/server";
import { readContentConfig } from "@/lib/content/config";
import { LoginForm } from "./LoginForm";
import "../staff.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};
export default async function LoginPage() {
  const staff = await currentStaff();
  if (staff)
    redirect(staff.profile.role === "superadmin" ? "/admin" : "/account");
  return (
    <section className="section container">
      <div className="staff-login staff-card">
        <p className="eyebrow">Municipality of Pinamungajan</p>
        <h1>Staff sign in</h1>
        <p>Access your municipal staff account.</p>
        <LoginForm
          enabled={readContentConfig(process.env).source === "supabase"}
        />
      </div>
    </section>
  );
}
