"use client";
import Link from "next/link";
import { useState } from "react";
import { Search, ArrowUpRight } from "lucide-react";
import { EmptyState } from "@/components/shared/ui";
export interface SearchRecord {
  id: string;
  title: string;
  category: string;
  href: string;
  description: string;
}
export function SiteSearch({ records }: { records: SearchRecord[] }) {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? records.filter((r) =>
        `${r.title} ${r.category} ${r.description}`
          .toLowerCase()
          .includes(query.toLowerCase().trim()),
      )
    : [];
  return (
    <>
      <label className="search-field">
        <Search size={20} />
        <span className="sr-only">Search the municipal website</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search services, news, ordinances, and resolutions…"
        />
      </label>
      <p className="results-count" aria-live="polite">
        {query.trim()
          ? `${filtered.length} results found`
          : "Enter a keyword to search the municipal portal."}
      </p>
      {filtered.length ? (
        <div className="document-list">
          {filtered.map((r) => (
            <Link href={r.href} key={r.id} className="document-card">
              <div className="document-content">
                <span className="eyebrow">{r.category}</span>
                <h2>{r.title}</h2>
                <p className="body-copy">{r.description}</p>
              </div>
              <ArrowUpRight size={20} />
            </Link>
          ))}
        </div>
      ) : query.trim() ? (
        <EmptyState />
      ) : (
        <div className="branch-links">
          <Link href="/services">Public services</Link>
          <Link href="/legislative/ordinances">Ordinances</Link>
          <Link href="/news">News & updates</Link>
        </div>
      )}
    </>
  );
}
