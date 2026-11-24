import Link from "next/link";
import {
  requireTransparency,
  transparencyRows,
} from "@/lib/transparency/server";
import { slotsFor, slotLabel } from "@/lib/transparency/config";
import { ReportFilters } from "@/components/transparency/ReportFilters";
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
  const text = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const q = text("q"),
    selectedModule = text("module"),
    year = text("year");
  const filtered = reports
    .filter(
      (r) =>
        (!selectedModule || r.category_id === selectedModule) &&
        (!year || String(r.report_year) === year) &&
        String(r.title).toLowerCase().includes(q.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.report_year) - Number(a.report_year) ||
        String(a.title).localeCompare(String(b.title)),
    );
  const pagination = pageDetails(filtered.length, params.page);
  const visibleReports = filtered.slice(pagination.from, pagination.to + 1);
  return (
    <div className="transparency-workspace">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Transparency</p>
          <h1>Reports & documents</h1>
          <p>Manage annual reports and quarterly PDF attachments.</p>
        </div>
        <div className="staff-actions">
          {canEdit && (
            <Link
              className="button button-blue"
              href="/admin/transparency/reports/new"
            >
              Add document
            </Link>
          )}
          <Link className="button" href="/admin/transparency/modules">
            Manage modules
          </Link>
          <Link className="button" href="/transparency">
            Public portal
          </Link>
        </div>
      </div>
      <ReportFilters
        modules={modules.map((m) => ({
          id: String(m.id),
          name: String(m.name),
        }))}
        years={[...new Set(reports.map((r) => Number(r.report_year)))].sort(
          (a, b) => b - a,
        )}
        q={q}
        module={selectedModule}
        year={year}
        base="/admin/transparency"
      />
      <div
        className="admin-table-wrap"
        role="region"
        aria-label="Transparency reports"
        tabIndex={0}
      >
        <table className="admin-table transparency-table">
          <thead>
            <tr>
              <th>Report Title</th>
              <th>Module</th>
              <th>Frequency</th>
              <th>Year</th>
              <th>Attachments</th>
              <th>Status</th>
              <th className="admin-actions-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleReports.map((r) => (
              <tr key={String(r.id)}>
                <td>{String(r.title)}</td>
                <td>
                  {String(
                    modules.find((m) => m.id === r.category_id)?.name || "",
                  )}
                </td>
                <td>
                  {r.report_frequency === "quarterly" ? "Quarterly" : "Annual"}
                </td>
                <td>{String(r.report_year)}</td>
                <td>
                  <div className="transparency-pdfs">
                    {slotsFor(String(r.report_frequency)).map((slot) =>
                      r[slot + "_pdf_path"] ? (
                        <a
                          key={slot}
                          href={
                            "/admin/transparency/files/" +
                            r.id +
                            "?period=" +
                            slot
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {slotLabel(slot)}
                        </a>
                      ) : (
                        <span key={slot} className="transparency-missing">
                          {slotLabel(slot)} —
                        </span>
                      ),
                    )}
                  </div>
                </td>
                <td>
                  <span
                    className={
                      "transparency-status " +
                      (r.published ? "is-published" : "")
                    }
                  >
                    {r.published ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="admin-actions-cell">
                  {canEdit ? (
                    <div className="admin-row-actions">
                      <AdminActionLink
                        href={"/admin/transparency/reports/" + r.id}
                        action="edit"
                        label={`Edit ${String(r.title)}`}
                      />
                      <TransparencyDelete
                        kind="documents"
                        id={String(r.id)}
                        updatedAt={String(r.updated_at)}
                        title={String(r.title)}
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
        {!filtered.length && (
          <p className="transparency-empty">
            No reports found. Add a document or adjust your filters.
          </p>
        )}
      </div>
      <AdminPagination
        pagination={pagination}
        params={params}
        label="Transparency reports pagination"
      />
    </div>
  );
}
