import Link from "next/link";
import { requireStaff } from "@/lib/auth/server";
export default async function Dashboard() {
  const { client } = await requireStaff(true);
  const [users, offices, branches] = await Promise.all([
    client
      .from("staff_accounts")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null),
    client
      .from("departments")
      .select("*", { count: "exact", head: true })
      .is("archived_at", null)
      .is("parent_department_id", null),
    client
      .from("departments")
      .select("*", { count: "exact", head: true })
      .is("archived_at", null)
      .not("parent_department_id", "is", null),
  ]);
  return (
    <>
      <p className="eyebrow">Municipality of Pinamungajan</p>
      <h1>Super Admin dashboard</h1>
      <p>Manage staff, office access, and municipal content.</p>
      <div className="staff-grid">
        <Link className="staff-card" href="/admin/transparency">
          <h2>Transparency</h2>
          <p>Publish bidding documents and award notices.</p>
        </Link>
        <Link className="staff-card" href="/superadmin/users">
          <h2>Users & permissions</h2>
          <p>{users.count ?? "—"} staff accounts</p>
          <p>Create accounts and assign office access.</p>
        </Link>
        <Link className="staff-card" href="/superadmin/departments">
          <h2>Departments</h2>
          <p>{offices.count ?? "—"} offices</p>
          <p>Manage Executive and Legislative offices.</p>
        </Link>
        <Link className="staff-card" href="/superadmin/branches">
          <h2>Branches</h2>
          <p>{branches.count ?? "—"} branches</p>
          <p>Manage branch profiles and their parent departments.</p>
        </Link>
        <Link className="staff-card" href="/admin/content">
          <h2>Content management</h2>
          <p>Review drafts, assign ownership, and publish.</p>
        </Link>
        <Link className="staff-card" href="/superadmin/barangays">
          <h2>Barangays</h2>
          <p>Manage barangay captains, square images and public profiles.</p>
        </Link>
        <Link className="staff-card" href="/superadmin/contact">
          <h2>Municipal Contact</h2>
          <p>Edit contact details and the Municipal Hall location map.</p>
        </Link>
        <Link className="staff-card" href="/superadmin/audit">
          <h2>Audit log</h2>
          <p>Review administrative changes.</p>
        </Link>
      </div>
    </>
  );
}
