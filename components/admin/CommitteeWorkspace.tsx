import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentBreadcrumb } from "./ContentBreadcrumb";
import { AdminPagination } from "./AdminPagination";
import { AdminActionLink } from "./AdminActionLink";
import { pageDetails } from "@/lib/admin/pagination";
import { TermSelector } from "@/components/legislative/TermSelector";
import { legislativeOptions } from "@/lib/legislative/server";
import { selectedTerm, philippineDate } from "@/lib/legislative/terms";
import {
  allowed,
  contentAllowed,
  type OfficeContext,
} from "@/lib/offices/server";

export async function CommitteeWorkspace({
  context,
  office,
  term,
  saved,
  page,
  historicalPage,
}: {
  context: OfficeContext;
  office?: string;
  term?: string;
  saved?: string;
  page?: string;
  historicalPage?: string;
}) {
  const owner = context.offices.find(
    (o) =>
      o.active &&
      o.department === "legislative" &&
      (!office || o.id === office) &&
      allowed(context, o.id, "read"),
  );
  if (!owner) notFound();
  const options = await legislativeOptions(context, owner.id, true);
  const terms = options.terms || [];
  const selected = selectedTerm(terms, term);
  const hasTerm = terms.some((t) => t.id === selected);
  const rows: Record<string, unknown>[] = [];
  if (hasTerm || selected === "unassigned") {
    for (;;) {
      let query = context.client
        .from("committees")
        .select("*", { count: "exact" })
        .eq("content_scope", "legislative")
        .eq("office_id", owner.id)
        .order("id");
      query =
        selected === "unassigned"
          ? query.is("term_id", null)
          : query.eq("term_id", selected);
      const result = await query.range(rows.length, rows.length + 499);
      if (result.error)
        throw new Error("Unable to load committee compositions.");
      rows.push(...(result.data || []));
      if (!result.data?.length || rows.length >= (result.count ?? Infinity))
        break;
    }
  }
  const canWrite = allowed(context, owner.id, "write");
  const officials = new Map(options.officials.map((o) => [o.id, o.name]));
  const official = (row: Record<string, unknown> | undefined, key: string) =>
    row?.[key]
      ? officials.get(String(row[key])) || "Official unavailable"
      : "Unassigned";
  const compositionCells = (row?: Record<string, unknown>) => (
    <>
      <td>
        {official(row, "chair_id")}
        {Boolean(row?.chair && !row.chair_id) && (
          <small className="staff-note">
            Legacy text: {String(row?.chair)}
          </small>
        )}
      </td>
      <td>{official(row, "vice_chair_id")}</td>
      <td>
        {row && [1, 2, 3, 4].some((n) => row[`member_${n}_id`]) ? (
          <ul className="committee-composition-members">
            {[1, 2, 3, 4]
              .filter((n) => row[`member_${n}_id`])
              .map((n) => (
                <li key={n}>{official(row, `member_${n}_id`)}</li>
              ))}
          </ul>
        ) : (
          "Unassigned"
        )}
      </td>
      <td>
        {row
          ? row.published === true
            ? "Published"
            : "Database update required"
          : "Composition unavailable"}
      </td>
    </>
  );
  const edit = (row: Record<string, unknown>) => (
    <AdminActionLink
      href={`/admin/content/committees/edit/${encodeURIComponent(String(row.id))}?office=${owner.id}`}
      action={
        contentAllowed(context, "committees", row, "write") ? "edit" : "view"
      }
    />
  );
  const historical =
    selected === "unassigned" ? rows : rows.filter((r) => !r.master_id);
  const masters = options.masters || [];
  const pagination = pageDetails(masters.length, page);
  const historyPagination = pageDetails(historical.length, historicalPage);
  const paginationParams = {
    office: owner.id,
    term: selected,
    page,
    historicalPage,
  };
  return (
    <>
      <ContentBreadcrumb
        context={context}
        office={owner.id}
        collection="committees"
      />
      <div className="admin-toolbar">
        <h1>Committees</h1>
        {context.profile.role === "superadmin" && (
          <Link href="/superadmin/master-committees">
            Manage Master Committees
          </Link>
        )}
      </div>
      <TermSelector
        terms={terms}
        selected={selected}
        today={philippineDate()}
      />
      {saved && <p role="status">Record saved successfully.</p>}
      {selected !== "unassigned" && (
        <>
          <p className="staff-note">
            Every term has a published composition for each Master Committee.
            Edit a composition to assign this term’s officials. Unfilled
            positions remain unassigned.
          </p>
          {hasTerm && rows.some((row) => row.published !== true) && (
            <p role="alert" className="staff-note">
              Some committee compositions are unpublished. Ask Superadmin to
              apply the automatic committee publication update.
            </p>
          )}
          {hasTerm &&
            masters.some(
              (master) => !rows.some((row) => row.master_id === master.id),
            ) && (
              <p role="alert" className="staff-note">
                Some committee compositions are missing. Restore them below or
                ask Superadmin to finish automatic committee setup.
              </p>
            )}
          <div className="admin-table-wrap">
            <table className="admin-table committee-composition-table">
              <thead>
                <tr>
                  <th>Committee</th>
                  <th>Chairperson</th>
                  <th>Vice-Chairperson</th>
                  <th>Members</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {masters
                  .slice(pagination.from, pagination.to + 1)
                  .map((master) => {
                    const row = rows.find((r) => r.master_id === master.id);
                    return (
                      <tr key={master.id}>
                        <td>
                          {master.name}
                          {Boolean(row && row.name !== master.name) && (
                            <small className="staff-note">
                              Saved name: {String(row?.name)}
                            </small>
                          )}
                        </td>
                        {compositionCells(row)}
                        <td className="admin-actions-cell">
                          {row ? (
                            edit(row)
                          ) : canWrite && hasTerm ? (
                            <AdminActionLink
                              href={`/admin/content/committees/new?office=${owner.id}&master=${master.id}&term=${selected}`}
                              action="edit"
                              label="Restore composition"
                            />
                          ) : hasTerm ? (
                            "Unavailable"
                          ) : (
                            "Select a term"
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <AdminPagination
            pagination={pagination}
            params={paginationParams}
            label="Committee pagination"
          />
          {!options.masters?.length && (
            <p>
              No master committees yet. Ask Superadmin to add the verified
              standing committee list.
            </p>
          )}
        </>
      )}
      {historical.length > 0 && (
        <>
          <h2>
            {selected === "unassigned"
              ? "Unassigned Historical Records"
              : "Historical Associations to Review"}
          </h2>
          <p className="staff-note">
            These existing records are preserved. Review the master association
            and term before saving; document links and saved names stay intact.
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table committee-composition-table">
              <thead>
                <tr>
                  <th>Saved Committee Name</th>
                  <th>Chairperson</th>
                  <th>Vice-Chairperson</th>
                  <th>Members</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {historical
                  .slice(historyPagination.from, historyPagination.to + 1)
                  .map((row) => (
                    <tr key={String(row.id)}>
                      <td>{String(row.name)}</td>
                      {compositionCells(row)}
                      <td className="admin-actions-cell">{edit(row)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <AdminPagination
            pagination={historyPagination}
            params={paginationParams}
            pageKey="historicalPage"
            label="Historical committee pagination"
          />
        </>
      )}
      {selected === "unassigned" && !historical.length && (
        <p>No unassigned historical records.</p>
      )}
    </>
  );
}
