import Link from "next/link";
import { officeContext } from "@/lib/offices/server";
export default async function Dashboard() {
  const { profile, offices, access } = await officeContext();
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
        <p>No offices have been assigned. Contact your Super Admin.</p>
      )}
    </>
  );
}
