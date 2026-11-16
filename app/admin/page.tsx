import { LegislativeOverview } from "@/components/admin/LegislativeOverview";
import Link from "next/link";
import { officeContext } from "@/lib/offices/server";
import { transparencyAccess } from "@/lib/transparency/permissions";
export default async function Dashboard() {
  const context = await officeContext();
  const { profile, offices, access } = context;
  if (
    profile.role !== "superadmin" &&
    !transparencyAccess(profile) &&
    offices.length === 1 &&
    offices[0].department === "legislative"
  )
    return <LegislativeOverview context={context} office={offices[0].id} />;
  return (
    <>
      <p className="eyebrow">Staff portal</p>
      <h1>Welcome, {profile.display_name || profile.email}</h1>
      <p>
        Your office determines which content you can manage. Your role and
        office permission level control editing and deletion.
      </p>
      {profile.role === "superadmin" && (
        <Link className="button button-blue" href="/superadmin">
          Super Admin dashboard
        </Link>
      )}
      {transparencyAccess(profile) && (
        <div className="staff-grid">
          <Link className="staff-card" href="/admin/transparency">
            <h2>Transparency reports</h2>
            <p>Annual and quarterly reports and PDFs.</p>
          </Link>
          <Link className="staff-card" href="/admin/transparency/modules">
            <h2>Transparency modules</h2>
            <p>Report categories and document counts.</p>
          </Link>
        </div>
      )}
      <h2>Your offices</h2>
      <div className="staff-grid">
        {offices
          .filter((o) => o.active)
          .map((o) => (
            <Link
              className="staff-card"
              key={o.id}
              href={`/admin/content?office=${o.id}`}
            >
              <p className="eyebrow">{o.department}</p>
              <h2>{o.short_name || o.name}</h2>
              <p>{o.name}</p>
              <small>
                {profile.role === "superadmin"
                  ? "Full access"
                  : access.find((a) => a.office_id === o.id)?.permission_level}
              </small>
            </Link>
          ))}
      </div>
      {!offices.length && (
        <p>
          {transparencyAccess(profile)
            ? "Your assigned workspace is Transparency."
            : "No offices have been assigned. Contact your Super Admin."}
        </p>
      )}
    </>
  );
}
