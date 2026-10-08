import Link from "next/link";
import { requireStaff } from "@/lib/auth/server";
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { client } = await requireStaff(true);
  const raw = Number((await searchParams).page || 1);
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const { data, error, count } = await client
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * 50, page * 50 - 1);
  return (
    <>
      <h1>Audit log</h1>
      <p>
        Administrative changes are recorded by database triggers. Password
        values are never logged.
      </p>
      {error ? (
        <p role="alert">Unable to load audit log.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor ID</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Office ID</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((row) => (
                <tr key={row.id}>
                  <td>
                    {new Date(row.created_at).toLocaleString("en-PH", {
                      timeZone: "Asia/Manila",
                    })}
                  </td>
                  <td>{row.user_id || "System"}</td>
                  <td>{row.action}</td>
                  <td>
                    {row.entity_type}
                    <small>{row.entity_id}</small>
                  </td>
                  <td>{row.office_id || "—"}</td>
                  <td>{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav className="staff-nav" aria-label="Audit pages">
        {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
        <span>Page {page}</span>
        {page * 50 < (count || 0) && (
          <Link href={`?page=${page + 1}`}>Next</Link>
        )}
      </nav>
    </>
  );
}
