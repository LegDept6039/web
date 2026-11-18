import { getTerms } from "@/lib/legislative/terms-server";
import { selectedTerm, termStatus } from "@/lib/legislative/terms";
import Link from "next/link";
import { DocumentTransferControls } from "@/components/admin/DocumentTransferControls";
import type { OfficeContext } from "@/lib/offices/server";
import { allowed, available } from "@/lib/offices/server";
import { documentTypes, isDocumentType } from "@/lib/legislative/config";
import type { Collection } from "@/lib/content/schema";
import { AdminPagination } from "./AdminPagination";
import { loadAdminPage } from "@/lib/admin/pagination";
export interface DocumentQuery {
  term?: string;
  office?: string;
  type?: string;
  q?: string;
  sort?: string;
  page?: string;
  saved?: string;
}
export async function LegislativeDocuments({
  context,
  collection,
  params,
}: {
  context: OfficeContext;
  collection: Collection;
  params: DocumentQuery;
}) {
  const terms = await getTerms(context.client);
  const selected = selectedTerm(terms, params.term);
  const type =
    collection === "ordinances"
      ? "ordinance"
      : collection === "resolutions"
        ? "resolution"
        : params.type;
  const heading =
    type && isDocumentType(type)
      ? type === "executive-order"
        ? "Executive Orders"
        : type === "agenda"
          ? "Agenda"
          : type === "minutes"
            ? "Minutes"
            : documentTypes[type] + "s"
      : "Documents";
  const sort = ["created_at", "date", "title", "number"].includes(
    params.sort || "",
  )
    ? params.sort!
    : "date";
  const q = (params.q || "").trim().slice(0, 150);
  let query = context.client
    .from("legislative_documents")
    .select("*", { count: "exact" })
    .eq("published", true)
    .eq("content_scope", "legislative");
  if (params.office) query = query.eq("office_id", params.office);
  else if (context.profile.role !== "superadmin")
    query = query.in(
      "office_id",
      context.offices
        .filter(
          (o) =>
            o.department === "legislative" && allowed(context, o.id, "read"),
        )
        .map((o) => o.id),
    );
  query =
    selected === "unassigned"
      ? query.is("term_id", null)
      : query.eq(
          "term_id",
          selected === "none"
            ? "00000000-0000-0000-0000-000000000000"
            : selected,
        );
  if (type) query = query.eq("document_type", type);
  if (q) query = query.ilike("title", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error, pagination } = await loadAdminPage(
    query
      .order(sort, { ascending: sort === "title" || sort === "number" })
      .order("id")
      .order("collection"),
    params.page,
  );
  const office = params.office ? `office=${params.office}` : "";
  return (
    <>
      <h1>{heading}</h1>
      {params.saved && <p role="status">Record saved successfully.</p>}
      <div className="admin-toolbar">
        {available(context, collection, params.office, "write") && (
          <Link
            className="button button-blue"
            href={`/admin/content/documents/new${office ? "?" + office : ""}`}
          >
            Add Document
          </Link>
        )}
        <DocumentTransferControls
          office={params.office}
          type={type && isDocumentType(type) ? type : undefined}
          offices={context.offices
            .filter(
              (o) =>
                o.active &&
                o.department === "legislative" &&
                allowed(context, o.id, "read"),
            )
            .map((o) => ({
              id: o.id,
              name: o.name,
              writable: allowed(context, o.id, "write"),
            }))}
        />
      </div>
      <form className="staff-form legislative-filters" method="get">
        <input type="hidden" name="office" value={params.office || ""} />
        {type && <input type="hidden" name="type" value={type} />}
        <label>
          Legislative Term
          <select name="term" defaultValue={selected}>
            <option value="none" disabled>
              No current term
            </option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} - {termStatus(t)}
              </option>
            ))}
            <option value="unassigned">Unassigned historical records</option>
          </select>
        </label>
        <label>
          Search title
          <input name="q" defaultValue={q} />
        </label>
        <label>
          Sort by
          <select aria-label="Sort by" name="sort" defaultValue={sort}>
            <option value="date">Document date (newest)</option>
            <option value="created_at">Newest added</option>
            <option value="title">Title (A-Z)</option>
            <option value="number">Document number</option>
          </select>
        </label>
        <button className="button button-blue">Apply</button>
      </form>
      {error ? (
        <p role="alert">
          Unable to load documents. Check that migration 014 is installed.
        </p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Number</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((r) => (
                  <tr key={`${r.collection}:${r.id}`}>
                    <td>{r.title}</td>
                    <td>
                      {isDocumentType(r.document_type)
                        ? documentTypes[
                            r.document_type as keyof typeof documentTypes
                          ]
                        : "Existing document"}
                    </td>
                    <td>{r.number || "-"}</td>
                    <td>{r.date}</td>
                    <td>
                      <Link
                        href={`/admin/content/${r.collection}/view/${r.id}?office=${r.office_id}`}
                      >
                        View
                      </Link>
                      {available(
                        context,
                        r.collection,
                        r.office_id,
                        "write",
                      ) && (
                        <>
                          {" "}
                          -{" "}
                          <Link
                            href={`/admin/content/${r.collection}/edit/${r.id}?office=${r.office_id}`}
                          >
                            Edit
                          </Link>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data?.length && <p>No published documents found.</p>}
          <AdminPagination
            pagination={pagination}
            params={{ ...params, term: selected, type, q, sort }}
            label="Documents pagination"
          />
        </>
      )}
    </>
  );
}
