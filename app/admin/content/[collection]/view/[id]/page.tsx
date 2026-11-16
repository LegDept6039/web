import Link from "next/link";
import { notFound } from "next/navigation";
import { officeContext, contentAllowed } from "@/lib/offices/server";
import { collectionName } from "@/lib/admin/content";
import { definitions } from "@/lib/content/schema";
import { isDocumentCollection } from "@/lib/legislative/config";
import { legislativeOptions } from "@/lib/legislative/server";
export default async function Page({
  params,
}: {
  params: Promise<{ collection: string; id: string }>;
}) {
  const { collection: name, id } = await params;
  const collection = collectionName(name);
  if (!collection || !isDocumentCollection(collection)) notFound();
  const context = await officeContext();
  const { data: r, error } = await context.client
    .from(definitions[collection].table)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (
    error ||
    !r ||
    r.content_scope !== "legislative" ||
    !r.published ||
    !contentAllowed(context, collection, r, "read")
  )
    notFound();
  const options = await legislativeOptions(context, r.office_id);
  const official = (id: string) =>
    options.officials.find((o) => o.id === id)?.name;
  return (
    <article className="staff-card">
      <h1>{r.title}</h1>
      <dl>
        {[
          ["Document number", r.number],
          ["Date", r.date_approved || r.date],
          ["Year", r.year],
          ["Author", r.author_id ? official(r.author_id) : r.author],
          [
            "Co-author",
            r.co_author_id
              ? official(r.co_author_id)
              : r.author_id
                ? null
                : r.co_author,
          ],
          [
            "Category",
            options.committees.find((o) => o.id === r.committee_id)?.name,
          ],
          [
            "Session",
            options.sessions.find((o) => o.id === r.session_id)?.name,
          ],
        ]
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label}>
              <dt>
                <strong>{label}</strong>
              </dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      <h2>Body</h2>
      <p className="legislative-record-body">{r.summary || r.description}</p>
      {(r.pdf_url || r.file_url) && (
        <p>
          <a href={r.pdf_url || r.file_url} target="_blank" rel="noreferrer">
            View PDF attachment
          </a>
        </p>
      )}
      <div className="staff-nav">
        <Link href={`/admin/content/${collection}?office=${r.office_id}`}>
          Back to documents
        </Link>
        {contentAllowed(context, collection, r, "write") && (
          <Link
            href={`/admin/content/${collection}/edit/${id}?office=${r.office_id}`}
          >
            Edit document
          </Link>
        )}
      </div>
    </article>
  );
}
