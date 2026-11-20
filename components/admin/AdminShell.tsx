import { legislativeNavigation } from "@/lib/legislative/navigation";
import { StaffSessionBoundary } from "./StaffSessionBoundary";
import { OfficesNav } from "./OfficesNav";
import { definitions, type Collection } from "@/lib/content/schema";
import { label } from "@/lib/admin/content";
import { SidebarNav } from "./SidebarNav";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import { officeContext, available } from "@/lib/offices/server";
import { transparencyAccess } from "@/lib/transparency/permissions";
import "@/app/staff.css";
export async function AdminShell({
  children,
  superadmin = false,
}: {
  children: React.ReactNode;
  superadmin?: boolean;
}) {
  const context = await officeContext();
  const base = context.profile.role === "superadmin" ? "/superadmin" : "/admin";
  return (
    <StaffSessionBoundary>
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
                <Link href="/superadmin/legislative-terms">
                  Legislative Terms
                </Link>
                <Link href="/superadmin/master-committees">
                  Master Committees
                </Link>
                <Link href="/superadmin/departments">Departments</Link>
                <Link href="/superadmin/contact">Municipal Contact</Link>
                <Link href="/superadmin/users">Users & access control</Link>
                <Link href="/superadmin/audit">Audit log</Link>
              </>
            )}
            <OfficesNav
              label={
                context.profile.role === "superadmin"
                  ? "Offices"
                  : "Your offices"
              }
              offices={[
                ...context.offices
                  .filter((o) => o.active)
                  .map((o) => ({
                    id: o.id,
                    name: o.short_name || o.name,
                    modules:
                      o.department === "legislative"
                        ? legislativeNavigation(context, o.id)
                        : [
                            {
                              key: "overview",
                              label: "Office overview",
                              href: `/admin/content?office=${o.id}`,
                            },
                            ...(Object.keys(definitions) as Collection[])
                              .filter((c) => available(context, c, o.id))
                              .map((c) => ({
                                key: c,
                                label:
                                  c === "departments"
                                    ? "Department Page & Head"
                                    : label(c),
                                href:
                                  c === "departments"
                                    ? `/admin/content/departments/edit/${o.id}?office=${o.id}`
                                    : `/admin/content/${c}?office=${o.id}`,
                              })),
                          ],
                  })),
                ...(transparencyAccess(context.profile)
                  ? [
                      {
                        id: "transparency",
                        name: "Transparency",
                        routePrefix: "/admin/transparency",
                        modules: [
                          {
                            key: "reports",
                            label: "Reports",
                            href: "/admin/transparency",
                          },
                          {
                            key: "modules",
                            label: "Modules",
                            href: "/admin/transparency/modules",
                          },
                        ],
                      },
                    ]
                  : []),
              ]}
            />
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
            <p className="staff-note">
              Fields marked{" "}
              <span className="required-star" aria-hidden="true">
                *
              </span>{" "}
              are required.
            </p>
            {children}
          </main>
        </div>
      </div>
    </StaffSessionBoundary>
  );
}
