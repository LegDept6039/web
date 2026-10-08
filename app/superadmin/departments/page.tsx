import Link from "next/link";
import { requireStaff } from "@/lib/auth/server";
export default async function Offices({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { client } = await requireStaff(true);
  const raw = Number((await searchParams).page || 1);
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const { data, error, count } = await client
    .from("departments")
    .select("*", { count: "exact" })
    .is("archived_at", null)
    .order("department")
    .order("name")
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.name}
                    <small>{o.slug}</small>
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
      <nav className="staff-nav" aria-label="Office pages">
        {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
        <span>Page {page}</span>
        {page * 25 < (count || 0) && (
          <Link href={`?page=${page + 1}`}>Next</Link>
        )}
      </nav>
    </>
  );
}
