import Link from "next/link";
import { requireStaff } from "@/lib/auth/server";
import { StaffForm } from "./StaffForm";
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { client } = await requireStaff(true);
  const requested = Number((await searchParams).page || 1);
  const page =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, 100000)
      : 1;
  const { data, error, count } = await client
    .from("staff_accounts")
    .select("user_id,email,display_name,role,active", { count: "exact" })
    .order("created_at")
    .order("user_id")
    .range((page - 1) * 24, page * 24 - 1);
  return (
    <>
      <h1>Staff accounts</h1>
      <p>
        Create accounts in Supabase Authentication → Users, then enable their
        access here. New accounts start disabled with the User role.
      </p>
      {error ? (
        <p role="alert">
          Unable to load staff accounts. Make sure the authentication migration
          is installed.
        </p>
      ) : (
        <>
          <div className="staff-grid">
            {data?.map((account) => (
              <StaffForm
                key={`${account.user_id}-${account.role}-${account.active}-${account.display_name}`}
                account={account}
              />
            ))}
          </div>
          <nav className="staff-nav" aria-label="Staff pages">
            {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
            <span>Page {page}</span>
            {page * 24 < (count || 0) && (
              <Link href={`?page=${page + 1}`}>Next</Link>
            )}
          </nav>
        </>
      )}
    </>
  );
}
