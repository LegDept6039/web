import Link from "next/link";
import { requireStaff } from "@/lib/auth/server";
import { loadAdminPage } from "@/lib/admin/pagination";
import { AdminPagination } from "@/components/admin/AdminPagination";

export default async function SKManagement({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; page?: string }>;
}) {
  const { client } = await requireStaff(true);
  const params = await searchParams;
  const { data, error, pagination } = await loadAdminPage(
    client
      .from("sk_profiles")
      .select("*,barangay:barangays(id,name,published)", { count: "exact" })
      .order("sort_order")
      .order("id"),
    params.page,
  );
  const needsSetup = ["42P01", "PGRST205", "PGRST200"].includes(
    error?.code || "",
  );
  return (
    <>
      <h1>SK profiles</h1>
      <p className="staff-note">
        Manage Sangguniang Kabataan chairpersons, images and profiles. Only
        Superadmin can change these pages.
      </p>
      <div className="admin-toolbar">
        <Link href="/sk">View public directory</Link>
        {!error && (
          <Link
            className="button button-blue"
            href="/superadmin/barangays/sk/new"
          >
            Add SK profile
          </Link>
        )}
      </div>
      {params.saved === "1" && (
        <p role="status">SK profile saved successfully.</p>
      )}
      {needsSetup ? (
        <div className="staff-card" role="status">
          <h2>SK profiles need setup</h2>
          <p>Apply migration 029 after 028, then reload this page.</p>
        </div>
      ) : error ? (
        <p role="alert">
          Unable to load SK profiles. Please reload and try again.
        </p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Barangay</th>
                  <th>SK Chairperson</th>
                  <th>Status</th>
                  <th>Display Order</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((row) => {
                  const barangay = row.barangay as unknown as {
                    name: string;
                    published: boolean;
                  } | null;
                  return (
                    <tr key={row.id}>
                      <td>{barangay?.name || "Unavailable barangay"}</td>
                      <td>{row.chairperson_name}</td>
                      <td>
                        {row.published
                          ? barangay?.published
                            ? "Published"
                            : "Hidden — barangay is unpublished"
                          : "Draft"}
                      </td>
                      <td>{row.sort_order}</td>
                      <td>
                        <Link href={`/superadmin/barangays/sk/${row.id}`}>
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!data?.length && <p>No SK profiles have been added yet.</p>}
          <AdminPagination
            pagination={pagination}
            params={params}
            label="SK pagination"
          />
        </>
      )}
    </>
  );
}
