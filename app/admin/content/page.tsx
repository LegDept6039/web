import { LegislativeOverview } from "@/components/admin/LegislativeOverview";
import { ContentBreadcrumb } from "@/components/admin/ContentBreadcrumb";
import Link from "next/link";
import { officeContext, available } from "@/lib/offices/server";
import { definitions, type Collection } from "@/lib/content/schema";
import { label } from "@/lib/admin/content";
export default async function ContentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ office?: string }>;
}) {
  const context = await officeContext();
  const { office } = await searchParams;
  const selected = context.offices.find((o) => o.id === office);
  if (office && !selected)
    return (
      <p role="alert">This office is unavailable or you do not have access.</p>
    );
  if (context.profile.role !== "superadmin" && !context.offices.length)
    return <p>No office access assigned.</p>;
  if (selected?.department === "legislative")
    return (
      <>
        <ContentBreadcrumb context={context} office={office} />
        <LegislativeOverview context={context} office={selected.id} />
      </>
    );
  return (
    <>
      <ContentBreadcrumb context={context} office={office} />
      <h1>{selected ? selected.name : "Content management"}</h1>
      <p>
        Select a content area. Your assigned office and role determine access.
      </p>
      <div className="staff-grid">
        {(Object.keys(definitions) as Collection[])
          .filter((key) => available(context, key, office))
          .map((key) => (
            <Link
              className="staff-card"
              key={key}
              href={`/admin/content/${key}${selected ? `?office=${selected.id}` : ""}`}
            >
              <h2>{label(key)}</h2>
              <p>View and manage records</p>
            </Link>
          ))}
      </div>
    </>
  );
}
