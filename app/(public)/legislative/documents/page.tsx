import { publicTerm } from "@/lib/legislative/terms-server";
import { inTerm, philippineDate } from "@/lib/legislative/terms";
import { TermSelector } from "@/components/legislative/TermSelector";
import Link from "next/link";
import { getCollection } from "@/lib/content/repository";
import { PageHero } from "@/components/shared/ui";
import { documentTypes, isDocumentType } from "@/lib/legislative/config";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; type?: string }>;
}) {
  const { type, term } = await searchParams;
  const { terms, selected } = await publicTerm(term);
  const records = await getCollection("documents", {
    content_scope: "legislative",
    ...(type && ["agenda", "minutes", "executive-order"].includes(type)
      ? { document_type: type }
      : {}),
  });
  return (
    <>
      <PageHero
        eyebrow="LEGISLATIVE RECORDS"
        title="Documents"
        description="Published agenda, minutes and executive orders."
      />
      <section className="container section">
        <TermSelector
          terms={terms}
          selected={selected}
          today={philippineDate()}
        />
        <nav className="branch-links" aria-label="Document types">
          <Link href={`/legislative/documents?term=${selected}`}>
            All documents
          </Link>
          {["agenda", "minutes", "executive-order"].map((t) => (
            <Link
              key={t}
              href={`/legislative/documents?type=${t}&term=${selected}`}
            >
              {isDocumentType(t) ? documentTypes[t] : t}
            </Link>
          ))}
        </nav>
        <div className="grid gap-6 md:grid-cols-2">
          {records
            .filter((d) => inTerm(d, selected))
            .map((d) => (
              <Link
                className="info-card"
                key={d.id}
                href={`/legislative/documents/${d.id}`}
              >
                <p>{d.date}</p>
                <h2>{d.title}</h2>
                <span>View document</span>
              </Link>
            ))}
        </div>
        {!records.some((d) => inTerm(d, selected)) && (
          <p>No published documents found.</p>
        )}
      </section>
    </>
  );
}
