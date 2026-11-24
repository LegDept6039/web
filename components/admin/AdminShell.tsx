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
import { isBarangayAffairsOffice } from "@/lib/barangays/permissions";
import { barangayAffairsNavigation } from "@/lib/barangays/navigation";
import type { Office } from "@/lib/offices/permissions";
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
  const branches = context.offices.filter(
    (o) => o.active && o.parent_department_id,
  );
  const executiveNavigation = (office: Office) => [
    {
      key: "overview",
      label: office.parent_department_id
        ? "Branch overview"
        : "Office overview",
      href: `/admin/content?office=${office.id}`,
    },
    ...(Object.keys(definitions) as Collection[])
      .filter((collection) => available(context, collection, office.id))
      .map((collection) => ({
        key: collection,
        label:
          collection === "departments"
            ? office.parent_department_id
              ? "Branch Page & Head"
              : "Department Page & Head"
            : label(collection),
        href:
          collection === "departments"
            ? `/admin/content/departments/edit/${office.id}?office=${office.id}`
            : `/admin/content/${collection}?office=${office.id}`,
      })),
  ];
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
            {context.profile.role !== "superadmin" && branches.length > 0 && (
              <Link href="/admin/branches">Branches</Link>
            )}
            {context.profile.role === "superadmin" && (
              <>
                <Link href="/superadmin/legislative-terms">
                  Legislative Terms
                </Link>
                <Link href="/superadmin/master-committees">
                  Master Committees
                </Link>
                <Link href="/superadmin/departments">Departments</Link>
                <Link href="/superadmin/branches">Branches</Link>
                {!context.offices.some(
                  (office) => isBarangayAffairsOffice(office) && office.active,
                ) && (
                  <OfficesNav
                    label=""
                    offices={[
                      {
                        id: "barangays",
                        name: "Barangays",
                        routePrefix: "/superadmin/barangays",
                        modules: [
                          {
                            key: "barangay",
                            label: "Barangay",
                            href: "/superadmin/barangays",
                          },
                          {
                            key: "sk",
                            label: "SK",
                            href: "/superadmin/barangays/sk",
                          },
                        ],
                      },
                    ]}
                  />
                )}
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
                  .filter((o) => o.active && !o.parent_department_id)
                  .map((o) => ({
                    id: o.id,
                    name: o.short_name || o.name,
                    ...(isBarangayAffairsOffice(o)
                      ? {
                          routePrefix:
                            context.profile.role === "superadmin"
                              ? "/superadmin/barangays"
                              : "/admin/barangays",
                        }
                      : {}),
                    modules: isBarangayAffairsOffice(o)
                      ? barangayAffairsNavigation(context, o.id)
                      : o.department === "legislative"
                        ? legislativeNavigation(context, o.id)
                        : executiveNavigation(o),
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
            {branches.length > 0 && (
              <OfficesNav
                label="Branches"
                offices={branches.map((office) => ({
                  id: office.id,
                  name: office.short_name || office.name,
                  modules: executiveNavigation(office),
                }))}
              />
            )}
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
              {context.profile.display_name || context.profile.username} —{" "}
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
