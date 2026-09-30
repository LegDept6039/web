import Link from "next/link";
import { requireStaff } from "@/lib/auth/server";
import { definitions } from "@/lib/content/schema";
import { label } from "@/lib/admin/content";
export default async function AdminPage() {
  const { profile } = await requireStaff(true);
  return (
    <>
      <p className="eyebrow">Superadmin</p>
      <h1>Website administration</h1>
      <p>
        Welcome, {profile.display_name || profile.email}. Manage published
        content and staff access.
      </p>
      <div className="staff-grid">
        {Object.keys(definitions).map((key) => (
          <Link className="staff-card" href={`/admin/content/${key}`} key={key}>
            <h2>{label(key)}</h2>
            <p>View drafts, edit records, and publish updates →</p>
          </Link>
        ))}
      </div>
    </>
  );
}
