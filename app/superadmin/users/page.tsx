import Link from "next/link";
import { officeContext, readOfficeAccess } from "@/lib/offices/server";
import { requireStaff } from "@/lib/auth/server";
import { loadAdminPage } from "@/lib/admin/pagination";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminActionLink } from "@/components/admin/AdminActionLink";
export default async function Users({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireStaff(true);
  const { client, offices } = await officeContext();
  const params = await searchParams;
  const {
    data: users,
    error,
    count,
    pagination,
  } = await loadAdminPage(
    client
      .from("staff_accounts")
      .select(
        "user_id,display_name,username,role,active,deleted_at,created_at,transparency_access",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .order("user_id"),
    params.page,
  );
  const access = (
    await Promise.all(
      (users || []).map(async (user) =>
        (await readOfficeAccess(client, user.user_id)).map((a) => ({
          ...a,
          user_id: user.user_id,
        })),
      ),
    )
  ).flat();
  return (
    <>
      <h1>Users & access control</h1>
      <p>Create staff accounts and assign access to multiple offices.</p>
      <div className="admin-toolbar">
        <span>{count || 0} accounts</span>
        <Link className="button button-blue" href="/superadmin/users/new">
          + Add User
        </Link>
      </div>
      {error ? (
        <p role="alert">Unable to load accounts or office assignments.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {[
                  "Name / User ID",
                  "Username",
                  "Role",
                  "Assigned access",
                  "Department",
                  "Status",
                  "Created",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className={h === "Actions" ? "admin-actions-cell" : undefined}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => {
                const assignments =
                  access?.filter((a) => a.user_id === u.user_id) || [];
                const assigned = offices.filter((o) =>
                  assignments.some((a) => a.office_id === o.id),
                );
                return (
                  <tr key={u.user_id}>
                    <td>
                      {u.display_name || "Unnamed"}
                      <small>{u.user_id}</small>
                    </td>
                    <td>{u.username}</td>
                    <td>{u.role}</td>
                    <td>
                      {assigned.map((o) => (
                        <div key={o.id}>
                          {o.short_name || o.name} (
                          {
                            assignments.find((a) => a.office_id === o.id)
                              ?.permission_level
                          }
                          )
                        </div>
                      ))}
                      {u.transparency_access && <div>Transparency</div>}
                      {!assigned.length && !u.transparency_access ? "None" : ""}
                    </td>
                    <td>
                      {[...new Set(assigned.map((o) => o.department))].join(
                        ", ",
                      ) || "—"}
                    </td>
                    <td>
                      {u.deleted_at
                        ? "Deleted"
                        : u.active
                          ? "Active"
                          : "Disabled"}
                    </td>
                    <td>
                      {new Date(u.created_at).toLocaleDateString("en-PH")}
                    </td>
                    <td className="admin-actions-cell">
                      <AdminActionLink
                        href={`/superadmin/users/${u.user_id}`}
                        action="edit"
                        label="Edit"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!error && (
        <AdminPagination
          pagination={pagination}
          params={params}
          label="Users pagination"
        />
      )}
    </>
  );
}
