import "@/app/staff.css";
export const metadata = {
  title: "Create a new password",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <main className="auth-shell">{children}</main>;
}
