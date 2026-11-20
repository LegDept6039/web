"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight, X } from "lucide-react";
import type { LegislativeDocument } from "@/types";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/shared/ui";
export function DocumentDirectory({
  documents,
  kind,
}: {
  documents: LegislativeDocument[];
  kind: "ordinances" | "resolutions";
}) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const years = [...new Set(documents.map((d) => d.year))].sort(
    (a, b) => b - a,
  );
  const filtered = documents.filter(
    (d) =>
      (year === "all" || String(d.year) === year) &&
      `${d.number} ${d.title} ${d.author} ${d.coAuthor ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  return (
    <>
      <div className="filter-bar">
        <label className="search-field">
          <Search size={19} />
          <span className="sr-only">Search {kind}</span>
          <input
            placeholder={`Search ${kind} by title, number, or author…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="select-field">
          <span className="sr-only">Filter by year</span>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <button
          className="reset-button"
          onClick={() => {
            setYear("all");
            setQuery("");
          }}
        >
          <X size={15} />
          Reset
        </button>
      </div>
      <div className="results-count" aria-live="polite">
        {filtered.length} {kind} found{" "}
        <span>Published legislative records</span>
      </div>
      {filtered.length > 0 && (
        <table className="legislative-table">
          <caption className="sr-only">Published {kind}</caption>
          <colgroup>
            <col className="record-number" />
            <col />
            <col className="record-date" />
            <col className="record-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">No.</th>
              <th scope="col">
                {kind === "ordinances" ? "Ordinance" : "Resolution"} title
              </th>
              <th scope="col">Approved</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id}>
                <td data-label="No.">{d.number}</td>
                <td className="record-title">
                  <h2>{d.title}</h2>
                  <p>
                    Author: {d.author}
                    {d.coAuthor ? ` | Co-author: ${d.coAuthor}` : ""}
                  </p>
                  <span className="status">{d.status}</span>
                </td>
                <td data-label="Approved">{formatDate(d.dateApproved)}</td>
                <td>
                  <Link
                    href={`/legislative/${kind}/${d.id}`}
                    className="text-link"
                  >
                    View record
                    <ArrowUpRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!filtered.length && <EmptyState />}
    </>
  );
}
