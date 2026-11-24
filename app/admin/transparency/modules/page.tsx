import Link from "next/link";
import { requireTransparency } from "@/lib/transparency/server";
import { transparencyRows } from "@/lib/transparency/server";
import { TransparencyDelete } from "@/components/admin/TransparencyDelete";
import { transparencyAccess } from "@/lib/transparency/permissions";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { pageDetails } from "@/lib/admin/pagination";
import { AdminActionLink } from "@/components/admin/AdminActionLink";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client, profile } = await requireTransparency();
  const canEdit = transparencyAccess(profile, true);
  const [modules, reports, params] = await Promise.all([
    transparencyRows(client, "document_categories"),
    transparencyRows(client, "municipal_documents"),
    searchParams,
  ]);
  const pagination = pageDetails(modules.length, params.page);
  const visibleModules = modules.slice(pagination.from, pagination.to + 1);
  return (
    <div className="transparency-workspace">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Transparency</p>
          <h1>Modules</h1>
          <p>Organize reports into reusable public categories.</p>
        </div>
        <div className="staff-actions">
          {canEdit && (
            <Link
              className="button button-blue"
              href="/admin/transparency/modules/new"
            >
              Add module
            </Link>
          )}
          <Link className="button" href="/admin/transparency">
            Manage reports
          </Link>
        </div>
      </div>
      <div
        className="admin-table-wrap"
        role="region"
        aria-label="Transparency modules"
        tabIndex={0}
      >
        <table className="admin-table transparency-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Documents</th>
              <th className="admin-actions-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleModules.map((m) => (
              <tr key={String(m.id)}>
                <td>{String(m.name)}</td>
                <td>
                  <div className="transparency-module-excerpt">
                    {String(m.description)}
                  </div>
                </td>
                <td>{reports.filter((r) => r.category_id === m.id).length}</td>
                <td className="admin-actions-cell">
                  {canEdit ? (
                    <div className="admin-row-actions">
                      <AdminActionLink
                        href={"/admin/transparency/modules/" + m.id}
                        action="edit"
                        label={`Edit ${String(m.name)}`}
                      />
                      <TransparencyDelete
                        kind="categories"
                        id={String(m.id)}
                        updatedAt={String(m.updated_at)}
                        title={String(m.name)}
                      />
                    </div>
                  ) : (
                    <span>Read only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!modules.length && (
          <p className="transparency-empty">
            No modules yet. Add your first module.
          </p>
        )}
      </div>
      <AdminPagination
        pagination={pagination}
        params={params}
        label="Transparency modules pagination"
      />
    </div>
  );
}
