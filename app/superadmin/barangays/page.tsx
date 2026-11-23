import Link from "next/link";
import { requireStaff } from "@/lib/auth/server";
import { loadAdminPage } from "@/lib/admin/pagination";
import { AdminPagination } from "@/components/admin/AdminPagination";

export default async function BarangayManagement({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; page?: string }>;
}) {
  const { client } = await requireStaff(true);
  const params = await searchParams;
  const { data, error, pagination } = await loadAdminPage(
    client
      .from("barangays")
      .select("*", { count: "exact" })
      .order("sort_order")
      .order("name")
      .order("id"),
    params.page,
  );
  const needsSetup = ["42P01", "PGRST205"].includes(error?.code || "");
  return (
    <>
      <h1>Barangays</h1>
      <p className="staff-note">
        Manage barangay images, captains and profiles. Only Superadmin can
        change these pages.
      </p>
      <div className="admin-toolbar">
        <Link href="/barangays">View public directory</Link>
        {!error && (
          <Link className="button button-blue" href="/superadmin/barangays/new">
            Add barangay
          </Link>
        )}
      </div>
      {params.saved === "1" && (
        <p role="status">Barangay saved successfully.</p>
      )}
      {needsSetup ? (
        <div className="staff-card" role="status">
          <h2>Barangays need setup</h2>
          <p>Apply migration 028 after 027, then reload this page.</p>
        </div>
      ) : error ? (
        <p role="alert">
          Unable to load barangays. Please reload and try again.
        </p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Barangay</th>
                  <th>Barangay Captain</th>
                  <th>Status</th>
                  <th>Display Order</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.captain_name}</td>
                    <td>{row.published ? "Published" : "Draft"}</td>
                    <td>{row.sort_order}</td>
                    <td>
                      <Link href={`/superadmin/barangays/${row.id}`}>Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data?.length && <p>No barangays have been added yet.</p>}
          <AdminPagination
            pagination={pagination}
            params={params}
            label="Barangay pagination"
          />
        </>
      )}
    </>
  );
}
