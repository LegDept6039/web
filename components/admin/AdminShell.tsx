import { OfficeLink } from "./OfficeLink";
import { SidebarNav } from "./SidebarNav";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import { officeContext, available } from "@/lib/offices/server";
import "@/app/staff.css";
export async function AdminShell({
  children,
  superadmin = false,
}: {
  children: React.ReactNode;
  superadmin?: boolean;
}) {
  const context = await officeContext();
  const base = superadmin ? "/superadmin" : "/admin";
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href={base} className="admin-brand">
          PINAMUNGAJAN<span>Municipal administration</span>
        </Link>
        <SidebarNav>
          <Link href={base}>Dashboard</Link>
          <Link href="/admin/content">Content management</Link>
          {context.profile.role === "superadmin" && (
            <>
              <Link href="/superadmin/departments">Departments</Link>
              <Link href="/superadmin/users">Users & access control</Link>
              <Link href="/superadmin/audit">Audit log</Link>
            </>
          )}
          <span className="admin-nav-label">Your offices</span>
          {context.offices
            .filter((o) => o.active)
            .map((o) => (
              <div key={o.id}>
                <OfficeLink office={o.id} name={o.short_name || o.name} />
                {o.department === "executive" &&
                  context.profile.role !== "superadmin" && (
                    <div className="admin-module-links">
                      <Link
                        href={`/admin/content/departments/edit/${o.id}?office=${o.id}`}
                      >
                        Department Page & Head
                      </Link>
                      {(["news", "programs", "contacts"] as const)
                        .filter((c) => available(context, c, o.id))
                        .map((c) => (
                          <Link
                            key={c}
                            href={`/admin/content/${c}?office=${o.id}`}
                          >
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </Link>
                        ))}
                    </div>
                  )}
              </div>
            ))}
          <Link href="/account">Profile</Link>
          <Link href="/">Public website</Link>
        </SidebarNav>
        <form action={logout}>
          <button className="button">Sign out</button>
        </form>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <strong>
            {superadmin ? "Super Admin" : "Office administration"}
          </strong>
          <span>
            {context.profile.display_name || context.profile.email} —{" "}
            {context.profile.role}
          </span>
        </header>
        <main id="main" className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
