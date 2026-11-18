import { getTerms } from "@/lib/legislative/terms-server";
import { selectedTerm, philippineDate } from "@/lib/legislative/terms";
import { TermSelector } from "@/components/legislative/TermSelector";
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
  if (!allowed(context, office, "read"))
    return <p role="alert">No access to this office.</p>;
  const terms = await getTerms(context.client);
  const selected = selectedTerm(terms, term);
  const modules = [
    ["officials", "Officials"],
    ["ordinances", "Ordinances"],
    ["resolutions", "Resolutions"],
    ["sessions", "Sessions"],
    ["committees", "Committees"],
    ["documents", "Documents"],
  ];
  const counts = await Promise.all(
    modules.map(async ([key]) => {
      let query = context.client
        .from(key === "documents" ? "municipal_documents" : key)
        .select("id", { head: true, count: "exact" })
        .eq("office_id", office)
        .eq("content_scope", "legislative");
      query =
        selected === "unassigned"
          ? query.is("term_id", null)
          : query.eq(
              "term_id",
              selected === "none"
                ? "00000000-0000-0000-0000-000000000000"
                : selected,
            );
      if (["documents", "ordinances", "resolutions"].includes(key))
        query = query.eq("published", true);
      return query;
    }),
  );
  return (
    <>
      <h1>Legislative Access</h1>
      <TermSelector
        terms={terms}
        selected={selected}
        today={philippineDate()}
      />
      <p>Office overview and published legislative documents.</p>
      <div className="staff-grid">
        {modules.map(([key, label], i) => (
          <Link
            key={key}
            className="staff-card"
            href={`/admin/content/${key}?office=${office}&term=${selected}`}
          >
            <h2>{label}</h2>
            {counts[i].error ? (
              <p role="alert">Count unavailable</p>
            ) : (
              <p className="legislative-count">{counts[i].count ?? 0}</p>
            )}
          </Link>
        ))}
      </div>
    </>
  );
}
