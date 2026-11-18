import { getTerms } from "@/lib/legislative/terms-server";
import { CommitteeWorkspace } from "@/components/admin/CommitteeWorkspace";
import { selectedTerm, philippineDate } from "@/lib/legislative/terms";
import { TermSelector } from "@/components/legislative/TermSelector";
import { LegislativeDocuments } from "@/components/admin/LegislativeDocuments";
import { isDocumentCollection } from "@/lib/legislative/config";
import { ContentBreadcrumb } from "@/components/admin/ContentBreadcrumb";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  officeContext,
  allowed,
  available,
  workflow,
  contentAllowed,
} from "@/lib/offices/server";
import { collectionName, label } from "@/lib/admin/content";
import { definitions } from "@/lib/content/schema";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { loadAdminPage } from "@/lib/admin/pagination";
export default async function ContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ collection: string }>;
  searchParams: Promise<{
    page?: string;
    historicalPage?: string;
    office?: string;
    term?: string;
    saved?: string;
    type?: string;
    q?: string;
    sort?: string;
  }>;
}) {
  const context = await officeContext();
  const collection = collectionName((await params).collection);
  if (!collection) notFound();
  const filters = await searchParams;
  const { page: raw, office, saved, term } = filters;
  if (office && !allowed(context, office, "read"))
    return <p role="alert">No access to this office.</p>;
  if (!available(context, collection, office)) notFound();
  const scope = workflow(context, office);
  if (scope === "legislative" && collection === "committees")
    return (
      <CommitteeWorkspace
        context={context}
        office={office}
        term={term}
        saved={saved}
        page={raw}
        historicalPage={filters.historicalPage}
      />
    );
  if (scope === "legislative" && isDocumentCollection(collection))
    return (
      <>
        <ContentBreadcrumb
          context={context}
          office={office}
          collection={collection}
        />
        <LegislativeDocuments
          context={context}
          collection={collection}
          params={filters}
        />
      </>
    );
  const termEnabled =
    scope === "legislative" &&
    ["officials", "committees", "sessions"].includes(collection);
  const terms = termEnabled ? await getTerms(context.client) : [];
  const selected = selectedTerm(terms, term);
  const { table, key } = definitions[collection];
  const dateOrdered = scope === "legislative" && collection === "sessions";
  let query = context.client
    .from(table)
    .select("*", { count: "exact" })
    .order(dateOrdered ? "date" : "sort_order", { ascending: !dateOrdered })
    .order(key);
  if (office) query = query.eq("content_scope", scope).eq("office_id", office);
  else if (context.profile.role !== "superadmin")
    query = query.eq("content_scope", scope).in(
      "office_id",
      context.offices
        .filter((o) => o.department === scope && allowed(context, o.id, "read"))
        .map((o) => o.id),
    );
  if (termEnabled)
    query =
      selected === "unassigned"
        ? query.is("term_id", null)
        : query.eq(
            "term_id",
            selected === "none"
              ? "00000000-0000-0000-0000-000000000000"
              : selected,
          );
  const { data, error, pagination } = await loadAdminPage(query, raw);
  const canCreate =
    collection !== "departments" &&
    available(context, collection, office, "write");
  return (
    <>
      <ContentBreadcrumb
        context={context}
        office={office}
        collection={collection}
      />
      <h1>{label(collection)}</h1>
      {termEnabled && (
        <TermSelector
          terms={terms}
          selected={selected}
          today={philippineDate()}
        />
      )}
      {saved && <p role="status">Record saved successfully.</p>}
      <div className="admin-toolbar">
        <Link href="/admin/content">All collections</Link>
        {canCreate && (
          <Link
            className="button button-blue"
            href={`/admin/content/${collection}/new${office ? `?office=${office}` : ""}`}
          >
            Add record
          </Link>
        )}
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
                  <th>{dateOrdered ? "Session Date" : "Sort Order"}</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((row) => (
                  <tr key={row[key]}>
                    <td>
                      {collection === "contacts"
                        ? `${row.label || row.type}: ${row.value}`
                        : row.title || row.name || row.number || row[key]}
                    </td>
                    <td>
                      {row.content_scope === "legislative"
                        ? "Legislative Access"
                        : context.offices.find((o) => o.id === row.office_id)
                            ?.short_name || "Unassigned"}
                    </td>
                    <td>{row.published ? "Published" : "Draft"}</td>
                    <td>{dateOrdered ? row.date : row.sort_order}</td>
                    <td>
                      <Link
                        href={`/admin/content/${collection}/edit/${encodeURIComponent(row[key])}${row.office_id ? `?office=${encodeURIComponent(row.office_id)}` : ""}`}
                      >
                        {contentAllowed(context, collection, row, "write")
                          ? "Edit"
                          : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data?.length && <p>No records found in your authorized offices.</p>}
          <AdminPagination
            pagination={pagination}
            params={{ ...filters, ...(termEnabled ? { term: selected } : {}) }}
            label="Content pagination"
          />
        </>
      )}
    </>
  );
}
