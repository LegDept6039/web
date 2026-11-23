import { getTerms } from "@/lib/legislative/terms-server";
import { selectedTerm, philippineDate } from "@/lib/legislative/terms";
import { TermSelector } from "@/components/legislative/TermSelector";
import { CalendarDays, FileText, FolderOpen, Gavel, Users } from "lucide-react";
import { getLegislativeDashboard } from "@/lib/legislative/dashboard-server";
import { LegislativeAuthorshipTable } from "./LegislativeAuthorshipTable";
import Link from "next/link";
import { type OfficeContext, allowed } from "@/lib/offices/server";
export async function LegislativeOverview({
  context,
  office,
  term,
}: {
  context: OfficeContext;
  office: string;
  term?: string;
}) {
  const selectedOffice = context.offices.find(
    (item) =>
      item.id === office &&
      item.active &&
      !item.archived_at &&
      item.department === "legislative",
  );
  if (!selectedOffice || !allowed(context, office, "read"))
    return <p role="alert">No access to this office.</p>;
  const terms = await getTerms(context.client);
  const selected = selectedTerm(terms, term);
  const dashboard = await getLegislativeDashboard(context, office, selected);
  const modules = [
    {
      key: "officials",
      label: "Officials",
      note: "Registered officials",
      icon: Users,
    },
    {
      key: "ordinances",
      label: "Ordinances",
      note: "Published ordinances",
      icon: Gavel,
    },
    {
      key: "resolutions",
      label: "Resolutions",
      note: "Published resolutions",
      icon: FileText,
    },
    {
      key: "sessions",
      label: "Sessions",
      note: "Recorded sessions",
      icon: CalendarDays,
    },
    {
      key: "documents",
      label: "Documents",
      note: "Published documents",
      icon: FolderOpen,
    },
  ] as const;
  return (
    <div className="legislative-dashboard">
      <div className="legislative-dashboard-heading">
        <p className="eyebrow">Legislative Access</p>
        <h1>Legislative dashboard</h1>
        <p>
          Track office records and each official&apos;s legislative authorship.
        </p>
      </div>
      <TermSelector
        terms={terms}
        selected={selected}
        today={philippineDate()}
      />
      <div className="legislative-summary-grid">
        {modules.map(({ key, label, note, icon: Icon }) => {
          const count = dashboard.counts[key];
          return (
            <Link
              key={key}
              className="legislative-summary-card"
              href={`/admin/content/${key}?${new URLSearchParams({ office, term: selected })}`}
            >
              <div className="legislative-summary-label">
                <h2>{label}</h2>
                <Icon size={18} aria-hidden="true" />
              </div>
              {count === null ? (
                <p className="legislative-count-error" role="alert">
                  Count unavailable
                </p>
              ) : (
                <p className="legislative-count">
                  {count.toLocaleString("en-PH")}
                </p>
              )}
              <p className="legislative-summary-note">{note}</p>
            </Link>
          );
        })}
      </div>
      <LegislativeAuthorshipTable
        key={`${office}:${selected}`}
        officials={dashboard.officials}
        officialsAvailable={dashboard.officialsAvailable}
        authorshipAvailable={dashboard.authorshipAvailable}
      />
    </div>
  );
}
