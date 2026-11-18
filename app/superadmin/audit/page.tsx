import { requireStaff } from "@/lib/auth/server";
import { loadAdminPage } from "@/lib/admin/pagination";
import { AdminPagination } from "@/components/admin/AdminPagination";
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { client } = await requireStaff(true);
  const params = await searchParams;
  const { data, error, pagination } = await loadAdminPage(
    client
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
    params.page,
    50,
  );
  return (
    <>
      <h1>Audit log</h1>
      <p>
        Administrative changes are recorded by database triggers. Password
        values are never logged.
      </p>
      {error ? (
        <p role="alert">Unable to load audit log.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor ID</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Office ID</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((row) => (
                <tr key={row.id}>
                  <td>
                    {new Date(row.created_at).toLocaleString("en-PH", {
                      timeZone: "Asia/Manila",
                    })}
                  </td>
                  <td>{row.user_id || "System"}</td>
                  <td>{row.action}</td>
                  <td>
                    {row.entity_type}
                    <small>{row.entity_id}</small>
                  </td>
                  <td>{row.office_id || "—"}</td>
                  <td>{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!error && (
        <AdminPagination
          pagination={pagination}
          params={params}
          label="Audit pages"
        />
      )}
    </>
  );
}
