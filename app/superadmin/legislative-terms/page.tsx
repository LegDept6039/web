import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
import { getTerms } from "@/lib/legislative/terms-server";
import { termDisplayName, termStatus } from "@/lib/legislative/terms";
import { TermForm } from "./TermForm";
import { pageDetails, paginationHref } from "@/lib/admin/pagination";
import { AdminPagination } from "@/components/admin/AdminPagination";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; saved?: string; page?: string }>;
}) {
  const { client } = await requireStaff(true);
  const terms = await getTerms(client);
  const params = await searchParams;
  const selected = terms.find((t) => t.id === params.edit);
  if (params.edit && !selected) notFound();
  const pagination = pageDetails(terms.length, params.page);
  const visibleTerms = terms.slice(pagination.from, pagination.to + 1);
  return (
    <>
      <h1>Legislative Terms</h1>
      {params.saved && <p role="status">Term saved.</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Term</th>
              <th>Start</th>
              <th>End</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleTerms.map((t) => (
              <tr key={t.id}>
                <td>{termDisplayName(t)}</td>
                <td>{t.start_date}</td>
                <td>{t.end_date}</td>
                <td>{termStatus(t)}</td>
                <td>
                  <Link
                    href={paginationHref(
                      { ...params, edit: t.id },
                      pagination.page,
                    )}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!terms.length && (
        <p>No terms yet. Create a term before assigning Legislative records.</p>
      )}
      <AdminPagination
        pagination={pagination}
        params={params}
        label="Legislative term pages"
      />
      {selected && (
        <Link
          href={paginationHref({ ...params, edit: undefined }, pagination.page)}
        >
          Create another term
        </Link>
      )}
      <TermForm key={selected?.id || "new"} term={selected} />
    </>
  );
}
