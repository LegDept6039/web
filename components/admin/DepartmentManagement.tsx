import Link from "next/link";
import { requireStaff } from "@/lib/auth/server";
import { loadAdminPage } from "@/lib/admin/pagination";
import { isBarangayAffairsOffice } from "@/lib/barangays/permissions";
import { AdminActionLink } from "./AdminActionLink";
import { AdminPagination } from "./AdminPagination";

export async function DepartmentManagement({
  searchParams,
  branches = false,
}: {
  searchParams: Promise<{ page?: string }>;
  branches?: boolean;
}) {
  const { client } = await requireStaff(true);
  const params = await searchParams;
  const base = branches ? "/superadmin/branches" : "/superadmin/departments";
  let query = client
    .from("departments")
    .select("*", { count: "exact" })
    .is("archived_at", null)
    .order("department")
    .order("sort_order")
    .order("id");
  query = branches
    ? query.not("parent_department_id", "is", null)
    : query.is("parent_department_id", null);
  const {
    data,
    error: departmentsError,
    pagination,
  } = await loadAdminPage(query, params.page);
  const parentNames = new Map<string, string>();
  let error = departmentsError;
  if (!error && branches && data?.length) {
    const parentIds = [
      ...new Set(
        data
          .map((office) => office.parent_department_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (parentIds.length) {
      const parents = await client
        .from("departments")
        .select("id,name")
        .in("id", parentIds);
      if (parents.error) error = parents.error;
      else
        for (const parent of parents.data ?? [])
          parentNames.set(parent.id, parent.name);
    }
  }
  return (
    <>
      <h1>{branches ? "Branches" : "Departments"}</h1>
      <div className="admin-toolbar">
        <p>
          {branches
            ? "Manage branch offices and their parent departments."
            : "Manage departments, profiles, and access scopes."}
        </p>
        <Link className="button button-blue" href={`${base}/new`}>
          {branches ? "+ Add Branch" : "+ Add Department"}
        </Link>
      </div>
      {error ? (
        <p role="alert">
          {branches
            ? "Unable to load branches."
            : "Unable to load departments."}
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{branches ? "Branch" : "Name"}</th>
                <th>Acronym</th>
                <th>{branches ? "Parent department" : "Government branch"}</th>
                <th>Status</th>
                <th>Publication Status</th>
                <th>Sort Order</th>
                <th className="admin-actions-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((office) => {
                return (
                  <tr key={office.id}>
                    <td>
                      {office.name}
                      <small>{office.slug}</small>
                      {String(office.head_description || "").replace(
                        /\r\n?/g,
                        "\n",
                      ).length > 800 && (
                        <small className="biography-review">
                          Biography exceeds 800 characters - review required.
                        </small>
                      )}
                    </td>
                    <td>{office.short_name}</td>
                    <td>
                      {branches
                        ? parentNames.get(office.parent_department_id ?? "") ||
                          "Unavailable parent"
                        : office.department}
                    </td>
                    <td>{office.active ? "Active" : "Inactive"}</td>
                    <td>
                      <span
                        className={`publication-status ${office.published ? "is-published" : "is-unpublished"}`}
                      >
                        {isBarangayAffairsOffice(office)
                          ? "Staff access workspace"
                          : office.published
                            ? "Published"
                            : "Unpublished"}
                      </span>
                    </td>
                    <td>{office.sort_order}</td>
                    <td className="admin-actions-cell">
                      <div className="admin-row-actions">
                        <AdminActionLink
                          href={`${base}/${office.id}`}
                          action="edit"
                          label={branches ? "Edit branch" : "Edit department"}
                        />
                        {!isBarangayAffairsOffice(office) && (
                          <AdminActionLink
                            href={`/admin/content/departments/edit/${office.id}?office=${office.id}`}
                            action="settings"
                            label="Edit page, head and images"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!data?.length && (
            <p className="staff-note">
              {branches ? "No branches yet." : "No departments yet."}
            </p>
          )}
        </div>
      )}
      {!error && (
        <AdminPagination
          pagination={pagination}
          params={params}
          label={branches ? "Branch pages" : "Department pages"}
        />
      )}
    </>
  );
}
