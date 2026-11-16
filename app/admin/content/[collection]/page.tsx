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
export default async function ContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ collection: string }>;
  searchParams: Promise<{
    page?: string;
    office?: string;
    saved?: string;
    type?: string;
    q?: string;
    sort?: string;
  }>;
}) {
  const context = await officeContext();
  const collection = collectionName((await params).collection);
  if (!collection) notFound();
  const { page: raw, office, saved } = await searchParams;
  const requested = Number(raw || 1);
  const page =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, 100000)
      : 1;
  if (office && !allowed(context, office, "read"))
    return <p role="alert">No access to this office.</p>;
  if (!available(context, collection, office)) notFound();
  const scope = workflow(context, office);
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
          params={await searchParams}
        />
      </>
    );
  const { table, key } = definitions[collection];
  let query = context.client
    .from(table)
    .select("*", { count: "exact" })
    .order("sort_order")
    .order(key);
  if (office) query = query.eq("content_scope", scope).eq("office_id", office);
  else if (context.profile.role !== "superadmin")
    query = query.eq("content_scope", scope).in(
      "office_id",
      context.offices
        .filter((o) => o.department === scope && allowed(context, o.id, "read"))
        .map((o) => o.id),
    );
  const { data, error, count } = await query.range(
    (page - 1) * 25,
    page * 25 - 1,
  );
  const canCreate =
    collection !== "departments" &&
    available(context, collection, office, "write");
  const suffix = office ? `&office=${office}` : "";
  return (
    <>
      <ContentBreadcrumb
        context={context}
        office={office}
        collection={collection}
      />
      <h1>{label(collection)}</h1>
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
                  <th>Sort Order</th>
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
                    <td>{row.sort_order}</td>
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
          <nav className="staff-nav" aria-label="Content pages">
            {page > 1 && (
              <Link href={`?page=${page - 1}${suffix}`}>Previous</Link>
            )}
            <span>Page {page}</span>
            {page * 25 < (count || 0) && (
              <Link href={`?page=${page + 1}${suffix}`}>Next</Link>
            )}
          </nav>
        </>
      )}
    </>
  );
}
