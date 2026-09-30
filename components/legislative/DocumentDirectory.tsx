"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, FileText, ArrowUpRight, X } from "lucide-react";
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
      <div className="document-list">
        {filtered.map((d) => (
          <article className="document-card" key={d.id}>
            <div className="document-icon">
              <FileText size={26} />
            </div>
            <div className="document-content">
              <div className="flex flex-wrap gap-3 items-center">
                <span className="eyebrow">
                  {kind === "ordinances" ? "Ordinance" : "Resolution"} No.{" "}
                  {d.number}
                </span>
                <span className="status">
                  {d.status}
                  {d.isSample ? " \u00b7 sample" : ""}
                </span>
              </div>
              <h2>{d.title}</h2>
              <div className="document-meta">
                <span>Approved: {formatDate(d.dateApproved)}</span>
                <span>Author: {d.author}</span>
                {d.coAuthor && <span>Co-author: {d.coAuthor}</span>}
              </div>
            </div>
            <Link href={`/legislative/${kind}/${d.id}`} className="text-link">
              View record
              <ArrowUpRight size={17} />
            </Link>
          </article>
        ))}
      </div>
      {!filtered.length && <EmptyState />}
    </>
  );
}
