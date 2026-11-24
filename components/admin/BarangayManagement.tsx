import Link from "next/link";
import {
  barangayAffairsAllowed,
  requireBarangayAffairs,
} from "@/lib/barangays/access";
import { loadAdminPage } from "@/lib/admin/pagination";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminActionLink } from "@/components/admin/AdminActionLink";

export async function BarangayManagement({
  searchParams,
  basePath,
}: {
  searchParams: Promise<{ saved?: string; page?: string }>;
  basePath: "/admin/barangays" | "/superadmin/barangays";
}) {
  const context = await requireBarangayAffairs();
  const { client } = context;
  const canWrite = barangayAffairsAllowed(context, "write");
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
        Manage barangay images, captains and profiles. Your Barangay Affairs
        assignment and staff role determine editing access.
      </p>
      <div className="admin-toolbar">
        <Link href="/barangays">View public directory</Link>
        {!error && canWrite && (
          <Link className="button button-blue" href={`${basePath}/new`}>
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
                  <th className="admin-actions-cell">Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.captain_name}</td>
                    <td>{row.published ? "Published" : "Draft"}</td>
                    <td>{row.sort_order}</td>
                    <td className="admin-actions-cell">
                      <AdminActionLink
                        href={`${basePath}/${row.id}`}
                        action={canWrite ? "edit" : "view"}
                      />
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
