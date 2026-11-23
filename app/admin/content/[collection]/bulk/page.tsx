import Link from "next/link";
import { notFound } from "next/navigation";
import { officeContext, contentAllowed } from "@/lib/offices/server";
import { getTerms } from "@/lib/legislative/terms-server";
import { philippineDate, selectedTerm } from "@/lib/legislative/terms";
import { ContentBreadcrumb } from "@/components/admin/ContentBreadcrumb";
import { BulkSessionForm } from "@/components/admin/BulkSessionForm";

export default async function BulkSessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ collection: string }>;
  searchParams: Promise<{ office?: string; term?: string }>;
}) {
  const context = await officeContext();
  if ((await params).collection !== "sessions") notFound();
  const requested = await searchParams;
  const offices = context.offices.filter(
    (o) =>
      o.active &&
      !o.archived_at &&
      o.department === "legislative" &&
      contentAllowed(
        context,
        "sessions",
        { office_id: o.id, content_scope: "legislative" },
        "write",
      ),
  );
  if (
    !offices.length ||
    (requested.office && !offices.some((o) => o.id === requested.office))
  )
    notFound();
  const office = requested.office || offices[0].id;
  const terms = await getTerms(context.client);
  return (
    <>
      <ContentBreadcrumb
        context={context}
        office={office}
        collection="sessions"
      />
      <h1>Bulk add sessions</h1>
      <p className="staff-note">
        Enter several sessions for one Legislative Term and save them together.
      </p>
      {terms.length ? (
        <BulkSessionForm
          offices={offices.map((o) => ({ id: o.id, name: o.name }))}
          office={office}
          terms={terms}
          term={selectedTerm(terms, requested.term)}
          today={philippineDate()}
        />
      ) : (
        <div className="staff-card">
          <p>
            No Legislative Terms are available. Ask Superadmin to create a term
            first.
          </p>
          <Link href={`/admin/content/sessions?office=${office}`}>
            Back to sessions
          </Link>
        </div>
      )}
    </>
  );
}
