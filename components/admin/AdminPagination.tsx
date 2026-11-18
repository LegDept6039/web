import Link from "next/link";
import {
  paginationHref,
  type pageDetails,
  type PaginationParams,
} from "@/lib/admin/pagination";

export function AdminPagination({
  pagination,
  params = {},
  pageKey = "page",
  label = "Table pagination",
}: {
  pagination: ReturnType<typeof pageDetails>;
  params?: PaginationParams;
  pageKey?: string;
  label?: string;
}) {
  const { page, pageCount, start, end, total, pageSize } = pagination;
  const pages = [...new Set([1, pageCount, page - 1, page, page + 1])]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);
  const href = (p: number) => paginationHref(params, p, pageKey);
  return (
    <nav className="admin-pagination" aria-label={label}>
      <p className="admin-pagination-summary">
        Showing {start}–{end} of {total}
        <span>{pageSize} per page</span>
      </p>
      {pageCount > 1 && (
        <div className="admin-pagination-controls">
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev">
              Previous
            </Link>
          ) : (
            <span aria-disabled="true">Previous</span>
          )}
          {pages.map((p, index) => (
            <span className="admin-pagination-item" key={p}>
              {index > 0 && p > pages[index - 1] + 1 && (
                <span className="admin-pagination-gap" aria-hidden="true">
                  …
                </span>
              )}
              {p === page ? (
                <span aria-current="page" aria-label={`Page ${p}`}>
                  {p}
                </span>
              ) : (
                <Link href={href(p)} aria-label={`Page ${p}`}>
                  {p}
                </Link>
              )}
            </span>
          ))}
          {page < pageCount ? (
            <Link href={href(page + 1)} rel="next">
              Next
            </Link>
          ) : (
            <span aria-disabled="true">Next</span>
          )}
        </div>
      )}
    </nav>
  );
}
