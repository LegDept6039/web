import Link from "next/link";
import { requireStaff } from "@/lib/auth/server";
import { loadAdminPage } from "@/lib/admin/pagination";
import { AdminPagination } from "@/components/admin/AdminPagination";
export default async function Offices({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { client } = await requireStaff(true);
  const params = await searchParams;
  const { data, error, pagination } = await loadAdminPage(
    client
      .from("departments")
      .select("*", { count: "exact" })
      .is("archived_at", null)
      .order("department")
      .order("sort_order")
      .order("id"),
    params.page,
  );
  return (
    <>
      <h1>Departments</h1>
      <div className="admin-toolbar">
        <p>Manage departments, profiles, and access scopes.</p>
        <Link className="button button-blue" href="/superadmin/departments/new">
          + Add Department
        </Link>
      </div>
      {error ? (
        <p role="alert">Unable to load offices.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Acronym</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Publication Status</th>
                <th>Sort Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.name}
                    <small>{o.slug}</small>
                    {String(o.head_description || "").replace(/\r\n?/g, "\n")
                      .length > 800 && (
                      <small className="biography-review">
                        Biography exceeds 800 characters - review required.
                      </small>
                    )}
                  </td>
                  <td>{o.short_name}</td>
                  <td>{o.department}</td>
                  <td>{o.active ? "Active" : "Inactive"}</td>
                  <td>
                    <span
                      className={`publication-status ${o.published ? "is-published" : "is-unpublished"}`}
                    >
                      {o.published ? "Published" : "Unpublished"}
                    </span>
                  </td>
                  <td>{o.sort_order}</td>
                  <td>
                    <Link href={`/superadmin/departments/${o.id}`}>
                      Edit / Deactivate
                    </Link>
                    <Link
                      href={`/admin/content/departments/edit/${o.id}?office=${o.id}`}
                    >
                      Page, head & images
                    </Link>
                  </td>
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
          label="Department pages"
        />
      )}
    </>
  );
}
