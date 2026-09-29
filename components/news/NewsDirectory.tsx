"use client";
import { useState } from "react";
import { Search, X } from "lucide-react";
import type { NewsArticle } from "@/types";
import { NewsGrid } from "./NewsCard";
import { EmptyState } from "@/components/shared/ui";
export function NewsDirectory({ articles }: { articles: NewsArticle[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All updates");
  const categories = [
    "All updates",
    ...new Set(articles.map((n) => n.category)),
  ];
  const filtered = articles.filter(
    (n) =>
      (category === "All updates" || n.category === category) &&
      `${n.title} ${n.excerpt} ${n.category}`
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
          <span className="sr-only">News category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <button
          className="reset-button"
          onClick={() => {
            setQuery("");
            setCategory("All updates");
          }}
        >
          <X size={15} />
          Reset
        </button>
      </div>
      <p className="results-count" aria-live="polite">
        {filtered.length} updates found
      </p>
      {filtered.length ? <NewsGrid articles={filtered} /> : <EmptyState />}
    </>
  );
}
