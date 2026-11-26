import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/server";
import { getCommitteeMasters } from "@/lib/legislative/committee-master";
import { MasterForm } from "./MasterForm";
import { pageDetails, paginationHref } from "@/lib/admin/pagination";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminActionLink } from "@/components/admin/AdminActionLink";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; saved?: string; page?: string }>;
}) {
  const { client } = await requireStaff(true);
  const committees = await getCommitteeMasters(client);
  const params = await searchParams;
  const selected = committees.find((c) => c.id === params.edit);
  if (params.edit && !selected) notFound();
  const pagination = pageDetails(committees.length, params.page);
  const visibleCommittees = committees.slice(
    pagination.from,
    pagination.to + 1,
  );
  return (
    <>
      <h1>Master Committees</h1>
      <p className="staff-note">
        Shared standing committee catalog. Adding a Master Committee creates a
        published composition in every Legislative Term. Officials are assigned
        separately for each term.
      </p>
      {params.saved && <p role="status">Master committee saved.</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Committee Name</th>
              <th>Sort Order</th>
              <th className="admin-actions-cell">Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleCommittees.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.sort_order}</td>
                <td className="admin-actions-cell">
                  <AdminActionLink
                    href={paginationHref(
                      { ...params, edit: c.id },
                      pagination.page,
                    )}
                    action="edit"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!committees.length && (
        <p>
          No master committees yet. Add the verified standing committee names
          below.
        </p>
      )}
      <AdminPagination
        pagination={pagination}
        params={params}
        label="Master committee pages"
      />
      {selected && (
        <Link
          href={paginationHref({ ...params, edit: undefined }, pagination.page)}
        >
          Add another committee
        </Link>
      )}
      <MasterForm key={selected?.id || "new"} committee={selected} />
    </>
  );
}
