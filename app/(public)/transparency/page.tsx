import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ChevronDown } from "lucide-react";
import { getDocumentCategories } from "@/lib/api/transparency";
import { getCollection } from "@/lib/content/repository";
import { PageHero } from "@/components/shared/ui";
import { ReportFilters } from "@/components/transparency/ReportFilters";
import { slotsFor, slotLabel } from "@/lib/transparency/config";
import type { MunicipalDocument } from "@/types";
export const metadata: Metadata = {
  title: "Transparency portal",
  description:
    "Browse published municipal reports, bids and awards, and annual or quarterly PDF documents.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [categories, documents, params] = await Promise.all([
    getDocumentCategories(),
    getCollection("documents", { content_scope: "transparency" }),
    searchParams,
  ]);
  const text = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const q = text("q"),
    selectedModule = text("module"),
    year = text("year");
  const path = (d: MunicipalDocument, slot: string) =>
    d[(slot + "PdfPath") as keyof MunicipalDocument];
  const available = documents.filter((d) =>
    slotsFor(d.reportFrequency || "annual").some((s) => path(d, s)),
  );
  const modules = categories.filter(
    (c) =>
      c.contentScope === "transparency" &&
      available.some((d) => d.categoryId === c.id),
  );
  const visible = modules
    .filter((m) => !selectedModule || m.id === selectedModule)
    .map((m) => ({
      ...m,
      reports: available
        .filter(
          (d) =>
            d.categoryId === m.id &&
            (!year || String(d.reportYear) === year) &&
            d.title.toLowerCase().includes(q.toLowerCase()),
        )
        .sort(
          (a, b) =>
            (b.reportYear || 0) - (a.reportYear || 0) ||
            a.title.localeCompare(b.title),
        ),
    }))
    .filter((m) => m.reports.length);
  return (
    <>
      <PageHero
        eyebrow="TRANSPARENCY PORTAL"
        title="Public records. Open access."
        description="Browse municipal reports, bidding documents and award notices by module and year."
      />
      <section className="container section transparency-public">
        <ReportFilters
          modules={modules}
          years={[
            ...new Set(
              available
                .map((d) => d.reportYear)
                .filter((y): y is number => !!y),
            ),
          ].sort((a, b) => b - a)}
          q={q}
          module={selectedModule}
          year={year}
          base="/transparency"
        />
        <p className="transparency-result-count">
          {visible.reduce((n, m) => n + m.reports.length, 0)} reports
        </p>
        <div className="transparency-accordions">
          {visible.map((m, index) => (
            <details
              key={m.id}
              className="transparency-module"
              open={!!selectedModule || !!q || !!year || index === 0}
            >
              <summary>
                <span>
                  <strong>{m.name}</strong>
                  <small>{m.reports.length} reports</small>
                </span>
                <ChevronDown size={18} />
              </summary>
              <div className="transparency-module-body">
                {m.description && (
                  <p className="transparency-module-description">
                    {m.description}
                  </p>
                )}
                {m.reports.map((d) => (
                  <article className="transparency-report" key={d.id}>
                    <div>
                      <h2>{d.title}</h2>
                      <p>
                        {d.reportYear} <span aria-hidden="true">·</span>{" "}
                        {d.reportFrequency === "quarterly"
                          ? "Quarterly"
                          : "Annual"}
                      </p>
                    </div>
                    <div className="transparency-pdfs">
                      {slotsFor(d.reportFrequency || "annual")
                        .filter((slot) => path(d, slot))
                        .map((slot) => (
                          <a
                            key={slot}
                            href={
                              "/transparency/files/" + d.id + "?period=" + slot
                            }
                            target="_blank"
                            rel="noreferrer"
                            aria-label={
                              slotLabel(slot) +
                              " — " +
                              d.title +
                              " " +
                              d.reportYear
                            }
                          >
                            <FileText size={14} />
                            {slotLabel(slot)}
                          </a>
                        ))}
                    </div>
                  </article>
                ))}
              </div>
            </details>
          ))}
        </div>
        {!visible.length && (
          <div className="empty-state">
            <FileText size={32} />
            <h2>
              {available.length
                ? "No matching reports"
                : "Reports awaiting publication"}
            </h2>
            <p>
              {available.length
                ? "Try another title, module or year."
                : "Published reports will appear here when available."}
            </p>
          </div>
        )}
        {categories.some((c) => c.contentScope !== "transparency") && (
          <aside className="transparency-legacy">
            <h2>Other public records</h2>
            <div>
              {categories
                .filter((c) => c.contentScope !== "transparency")
                .map((c) => (
                  <Link key={c.id} href={c.href || "/transparency/" + c.id}>
                    {c.name}
                  </Link>
                ))}
            </div>
          </aside>
        )}
      </section>
    </>
  );
}
