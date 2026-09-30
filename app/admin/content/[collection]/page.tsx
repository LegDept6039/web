import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
import { collectionName, label } from "@/lib/admin/content";
import { definitions } from "@/lib/content/schema";
export default async function ContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ collection: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { client } = await requireStaff(true);
  const collection = collectionName((await params).collection);
  if (!collection) notFound();
  const requested = Number((await searchParams).page || 1);
  const page =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, 100000)
      : 1;
  const { table, key } = definitions[collection];
  const { data, error, count } = await client
    .from(table)
    .select("*", { count: "exact" })
    .order("sort_order")
    .order(key)
    .range((page - 1) * 25, page * 25 - 1);
  return (
    <>
      <h1>{label(collection)}</h1>
      <Link
        className="button button-blue"
        href={`/admin/content/${collection}/new`}
      >
        Add record
      </Link>
      {error ? (
        <p role="alert">
          Unable to load records. Check your connection and database setup.
        </p>
      ) : (
        <>
          {data?.map((row) => (
            <div className="staff-row" key={row[key]}>
              <Link
                href={`/admin/content/${collection}/edit/${encodeURIComponent(row[key])}`}
              >
                {row.title || row.name || row.number || row[key]}
              </Link>
              <span>
                {row.published ? "Published" : "Draft"}
                {row.is_sample ? " · Sample" : ""}
              </span>
            </div>
          ))}
          {!data?.length && <p>No records on this page.</p>}
          <nav className="staff-nav" aria-label="Content pages">
            {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
            <span>Page {page}</span>
            {page * 25 < (count || 0) && (
              <Link href={`?page=${page + 1}`}>Next</Link>
            )}
          </nav>
        </>
      )}
    </>
  );
}
