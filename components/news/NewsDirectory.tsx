"use client";
import { useState } from "react";
import { Search, X } from "lucide-react";
import type { NewsArticle } from "@/types";
import { NewsGrid } from "./NewsCard";
import { EmptyState } from "@/components/shared/ui";
import {
  getNewsSource,
  newsOfficeId,
  newsOfficeOptions,
} from "@/lib/news/source";
export function NewsDirectory({
  articles,
  departments,
}: {
  articles: NewsArticle[];
  departments?: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const offices = departments ?? newsOfficeOptions(articles);
  const filtered = articles.filter(
    (n) =>
      (!department || newsOfficeId(n) === department) &&
      `${n.title} ${n.excerpt} ${getNewsSource(n).name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="filter-bar">
        <label className="search-field">
          <Search size={19} />
          <span className="sr-only">Search news</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search news and updates…"
          />
        </label>
        <label className="select-field">
          <span className="sr-only">Department</span>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">All Departments</option>
            {offices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="reset-button"
          onClick={() => {
            setQuery("");
            setDepartment("");
          }}
        >
          <X size={15} />
          Reset
        </button>
      </div>
      <p className="results-count" aria-live="polite">
        {filtered.length} updates found
      </p>
      {filtered.length ? (
        <NewsGrid articles={filtered} uniform />
      ) : (
        <EmptyState />
      )}
    </>
  );
}
