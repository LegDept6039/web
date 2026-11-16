import Link from "next/link";
export function ReportFilters({
  modules,
  years,
  q,
  module,
  year,
  base,
}: {
  modules: { id: string; name: string }[];
  years: number[];
  q: string;
  module: string;
  year: string;
  base: string;
}) {
  return (
    <form method="get" className="transparency-filters">
      <label>
        Search reports
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search report title"
        />
      </label>
      <label>
        Module
        <select name="module" defaultValue={module}>
          <option value="">All modules</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Year
        <select name="year" defaultValue={year}>
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <button className="button button-blue">Search</button>
      <Link href={base}>Clear filters</Link>
    </form>
  );
}
