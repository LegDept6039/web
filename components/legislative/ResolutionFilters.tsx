"use client";

import Form from "next/form";
import Link from "next/link";
import { Search, X } from "lucide-react";

export function ResolutionFilters({
  term,
  query,
  year,
  years,
  resetHref,
}: {
  term: string;
  query: string;
  year: string;
  years: number[];
  resetHref: string;
}) {
  const options = [
    ...new Set([...years, ...(year !== "all" ? [Number(year)] : [])]),
  ].sort((a, b) => b - a);
  return (
    <Form
      action="/legislative/resolutions"
      className="filter-bar"
      scroll={false}
    >
      <input type="hidden" name="term" value={term} />
      <label className="search-field">
        <Search size={19} aria-hidden="true" />
        <span className="sr-only">Search resolutions</span>
        <input
          name="q"
          defaultValue={query}
          maxLength={200}
          placeholder="Search resolutions by title, number, or author…"
        />
      </label>
      <label className="select-field">
        <span className="sr-only">Filter by year</span>
        <select
          name="year"
          defaultValue={year}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          <option value="all">All years</option>
          {options.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="reset-button">
        Search
      </button>
      <Link className="reset-button" href={resetHref} scroll={false}>
        <X size={15} aria-hidden="true" />
        Reset
      </Link>
    </Form>
  );
}
