import Link from "next/link";
import { notFound } from "next/navigation";
import {
  allowed,
  available,
  contentAllowed,
  workflow,
  type OfficeContext,
} from "@/lib/offices/server";
import { loadAdminPage, type PaginationParams } from "@/lib/admin/pagination";
import { AdminActionLink } from "./AdminActionLink";
import { AdminPagination } from "./AdminPagination";
import { ContentBreadcrumb } from "./ContentBreadcrumb";

export async function DepartmentContentList({
  context,
  mode,
  office,
  filters = {},
}: {
  context: OfficeContext;
  mode: "departments" | "branches";
  office?: string;
  filters?: PaginationParams;
}) {
  const branches = mode === "branches";
  const selected = context.offices.find((item) => item.id === office);
  if (
    ((!branches || office) && !available(context, "departments", office)) ||
    (office && !allowed(context, office, "read")) ||
    (branches && office && !selected?.parent_department_id)
  )
    notFound();
  const scope = branches ? "executive" : workflow(context, office);
  const offices = context.offices.filter(
    (item) =>
      item.department === scope &&
      Boolean(item.parent_department_id) === branches &&
      allowed(context, item.id, "read") &&
      (!branches || available(context, "departments", item.id)),
  );
  if (branches && context.profile.role !== "superadmin" && !offices.length)
    notFound();
  let query = context.client
    .from("departments")
    .select("*", { count: "exact" })
    .is("archived_at", null)
    .order("sort_order")
    .order("id");
  query = branches
    ? query
        .not("parent_department_id", "is", null)
        .eq("department", "executive")
    : query.is("parent_department_id", null);
  if (office) query = query.eq("content_scope", scope).eq("office_id", office);
  else if (context.profile.role !== "superadmin")
    query = query.eq("content_scope", scope).in(
      "office_id",
      offices.map((item) => item.id),
    );
  const { data, error, pagination } = await loadAdminPage(query, filters.page);
  return (
    <>
      {branches ? (
        <nav aria-label="Breadcrumb" className="admin-breadcrumb">
          <Link href="/admin">Admin</Link>
          <span>/</span>
          <Link href="/admin/branches">Branches</Link>
          {selected && (
            <>
              <span>/</span>
              <span>{selected.short_name || selected.name}</span>
            </>
          )}
        </nav>
      ) : (
        <ContentBreadcrumb
          context={context}
          office={office}
          collection="departments"
        />
      )}
      <h1>{branches ? "Branches" : "Department Page"}</h1>
      {filters.saved && <p role="status">Record saved successfully.</p>}
      <div className="admin-toolbar">
        <Link href="/admin/content">All collections</Link>
      </div>
      {error ? (
        <p role="alert">Unable to load records.</p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Office</th>
                  <th>Status</th>
                  <th>Sort Order</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>
                      {row.content_scope === "legislative"
                        ? "Legislative Access"
                        : context.offices.find(
                            (item) => item.id === row.office_id,
                          )?.short_name ||
                          context.offices.find(
                            (item) => item.id === row.office_id,
                          )?.name ||
                          "Unassigned"}
                    </td>
                    <td>{row.published ? "Published" : "Draft"}</td>
                    <td>{row.sort_order}</td>
                    <td className="admin-actions-cell">
                      <AdminActionLink
                        href={`/admin/content/departments/edit/${encodeURIComponent(row.id)}?office=${encodeURIComponent(row.office_id || row.id)}`}
                        action={
                          contentAllowed(context, "departments", row, "write")
                            ? "edit"
                            : "view"
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data?.length && (
            <p>
              No {branches ? "branches" : "departments"} found in your
              authorized offices.
            </p>
          )}
          <AdminPagination
            pagination={pagination}
            params={{ ...filters, ...(office ? { office } : {}) }}
            label={branches ? "Branch pagination" : "Content pagination"}
          />
        </>
      )}
    </>
  );
}
