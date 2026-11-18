"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type LegislativeTerm, termStatus } from "@/lib/legislative/terms";
export function TermSelector({
  terms,
  selected,
  today,
  compact = false,
}: {
  terms: LegislativeTerm[];
  selected: string;
  today: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const term = terms.find((t) => t.id === selected);
  return (
    <div className={`term-selector${compact ? " term-selector-compact" : ""}`}>
      <label>
        Legislative Term
        <select
          aria-label="Legislative Term"
          value={selected}
          onChange={(event) => {
            const next = new URLSearchParams(params.toString());
            next.set("term", event.target.value);
            next.delete("page");
            next.delete("historicalPage");
            router.push(`${pathname}?${next}`);
          }}
        >
          <option value="none" disabled>
            No current term
          </option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} - {termStatus(t, today)}
            </option>
          ))}
          <option value="unassigned">Unassigned historical records</option>
        </select>
      </label>
      {term && (
        <p>
          <time dateTime={term.start_date}>
            {compact ? formatDate(term.start_date) : term.start_date}
          </time>
          {" – "}
          <time dateTime={term.end_date}>
            {compact ? formatDate(term.end_date) : term.end_date}
          </time>
        </p>
      )}
      {selected === "none" && (
        <p>
          No Legislative Term covers today. Choose a historical term to browse
          its records.
        </p>
      )}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
