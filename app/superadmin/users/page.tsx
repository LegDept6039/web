import Link from "next/link";
import { officeContext, readOfficeAccess } from "@/lib/offices/server";
import { requireStaff } from "@/lib/auth/server";
export default async function Users({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireStaff(true);
  const { client, offices } = await officeContext();
  const raw = Number((await searchParams).page || 1);
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const {
    data: users,
    error,
    count,
  } = await client
    .from("staff_accounts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("user_id")
    .range((page - 1) * 25, page * 25 - 1);
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
                  "Email",
                  "Role",
                  "Assigned offices",
                  "Department",
                  "Status",
                  "Created",
                  "Actions",
                ].map((h) => (
                  <th key={h}>{h}</th>
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
                    <td>{u.email}</td>
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
                      {!assigned.length ? "None" : ""}
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
                    <td>
                      <Link href={`/superadmin/users/${u.user_id}`}>
                        View / Edit / Manage access
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <nav className="staff-nav" aria-label="Users pagination">
        {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
        <span>Page {page}</span>
        {page * 25 < (count || 0) && (
          <Link href={`?page=${page + 1}`}>Next</Link>
        )}
      </nav>
    </>
  );
}
