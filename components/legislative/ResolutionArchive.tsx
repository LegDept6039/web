import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { EmptyState } from "@/components/shared/ui";
import { ResolutionFilters } from "./ResolutionFilters";
import {
  resolutionArchiveHref,
  type ResolutionArchiveResult,
} from "@/lib/legislative/resolution-archive";
import { formatDate } from "@/lib/utils";
import styles from "./ResolutionArchive.module.css";

export function ResolutionArchive({
  result,
  term,
}: {
  result: ResolutionArchiveResult;
  term: string;
}) {
  const { documents, total, page, pageSize, years, query, year } = result;
  const state = { term, q: query, year, page: String(page) };
  const returnTo = resolutionArchiveHref(state);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);
  return (
    <>
      <ResolutionFilters
        key={JSON.stringify([term, query, year])}
        term={term}
        query={query}
        year={year}
        years={years}
        resetHref={resolutionArchiveHref({ term })}
      />
      <div className="results-count" aria-live="polite">
        {total} resolutions found <span>Published legislative records</span>
      </div>
      {documents.length ? (
        <table className="legislative-table">
          <caption className="sr-only">Published resolutions</caption>
          <colgroup>
            <col className="record-number" />
            <col />
            <col className="record-date" />
            <col className="record-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">No.</th>
              <th scope="col">Resolution title</th>
              <th scope="col">Approved</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td data-label="No.">{document.number}</td>
                <td className="record-title">
                  <h2>{document.title}</h2>
                  <p>
                    {document.approvalMode === "mass_motion"
                      ? "Approval: Mass motion"
                      : `Author: ${document.author}${document.coAuthor ? ` | Co-author: ${document.coAuthor}` : ""}`}
                  </p>
                  <span className="status">{document.status}</span>
                </td>
                <td data-label="Approved">
                  {formatDate(document.dateApproved)}
                </td>
                <td>
                  <Link
                    href={`/legislative/resolutions/${encodeURIComponent(document.id)}?${new URLSearchParams({ returnTo })}`}
                    className="text-link"
                  >
                    View record <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState />
      )}
      {total > 0 && (
        <nav className={styles.pagination} aria-label="Resolutions pagination">
          <p>
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, total)} of {total}
            {" · "}Page {page} of {pageCount}
          </p>
          {pageCount > 1 && (
            <div className={styles.links}>
              {page > 1 && (
                <Link
                  href={resolutionArchiveHref({
                    ...state,
                    page: String(page - 1),
                  })}
                >
                  Previous page
                </Link>
              )}
              {pages.map((value, index) => (
                <span key={value} className={styles.pageItem}>
                  {index > 0 && value - pages[index - 1] > 1 && (
                    <span aria-hidden="true">…</span>
                  )}
                  {value === page ? (
                    <span aria-current="page" className={styles.current}>
                      <span className="sr-only">Page </span>
                      {value}
                    </span>
                  ) : (
                    <Link
                      href={resolutionArchiveHref({
                        ...state,
                        page: String(value),
                      })}
                      aria-label={`Page ${value}`}
                    >
                      {value}
                    </Link>
                  )}
                </span>
              ))}
              {page < pageCount && (
                <Link
                  href={resolutionArchiveHref({
                    ...state,
                    page: String(page + 1),
                  })}
                >
                  Next page
                </Link>
              )}
            </div>
          )}
        </nav>
      )}
    </>
  );
}
