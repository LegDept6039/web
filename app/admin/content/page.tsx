import { LegislativeOverview } from "@/components/admin/LegislativeOverview";
import { ContentBreadcrumb } from "@/components/admin/ContentBreadcrumb";
import Link from "next/link";
import { officeContext, available, allowed } from "@/lib/offices/server";
import { definitions, type Collection } from "@/lib/content/schema";
import { label } from "@/lib/admin/content";
import { isBarangayAffairsOffice } from "@/lib/barangays/permissions";
import { barangayAffairsAllowed } from "@/lib/barangays/access";
export default async function ContentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ office?: string; term?: string }>;
}) {
  const context = await officeContext();
  const { office, term } = await searchParams;
  const selected = context.offices.find((o) => o.id === office);
  const hasDepartments = context.offices.some(
    (item) =>
      !item.parent_department_id &&
      allowed(context, item.id, "read") &&
      available(context, "departments", item.id),
  );
  const hasBranches = context.offices.some(
    (item) =>
      item.parent_department_id &&
      allowed(context, item.id, "read") &&
      available(context, "departments", item.id),
  );
  if (office && !selected)
    return (
      <p role="alert">This office is unavailable or you do not have access.</p>
    );
  if (context.profile.role !== "superadmin" && !context.offices.length)
    return <p>No office access assigned.</p>;
  if (isBarangayAffairsOffice(selected)) {
    if (!selected?.active || !barangayAffairsAllowed(context))
      return <p role="alert">Barangay Affairs access is unavailable.</p>;
    const base =
      context.profile.role === "superadmin"
        ? "/superadmin/barangays"
        : "/admin/barangays";
    return (
      <>
        <ContentBreadcrumb context={context} office={selected.id} />
        <h1>Barangay Affairs</h1>
        <p>
          Manage barangay profiles and news. Your staff role determines editing
          access.
        </p>
        <div className="staff-grid">
          <Link className="staff-card" href={base}>
            <h2>Barangays</h2>
            <p>Community profiles, images and barangay captains.</p>
          </Link>
          <Link
            className="staff-card"
            href={`/admin/content/news?office=${selected.id}`}
          >
            <h2>News</h2>
            <p>Stories and updates linked to a barangay.</p>
          </Link>
        </div>
      </>
    );
  }
  if (selected?.department === "legislative")
    return (
      <>
        <ContentBreadcrumb context={context} office={office} />
        <LegislativeOverview
          context={context}
          office={selected.id}
          term={term}
        />
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
          .filter(
            (key) =>
              available(context, key, office) &&
              (key !== "departments" || Boolean(selected) || hasDepartments),
          )
          .map((key) => (
            <Link
              className="staff-card"
              key={key}
              href={
                key === "departments" && selected?.parent_department_id
                  ? `/admin/branches?office=${selected.id}`
                  : `/admin/content/${key}${selected ? `?office=${selected.id}` : ""}`
              }
            >
              <h2>
                {key === "departments" && selected?.parent_department_id
                  ? "Branch Page"
                  : label(key)}
              </h2>
              <p>View and manage records</p>
            </Link>
          ))}
        {!selected && hasBranches && (
          <Link className="staff-card" href="/admin/branches">
            <h2>Branches</h2>
            <p>View and manage branch pages</p>
          </Link>
        )}
      </div>
    </>
  );
}
