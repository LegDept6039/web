import Link from "next/link";
import { getCollection } from "@/lib/content/repository";
import { PageHero } from "@/components/shared/ui";
import { documentTypes, isDocumentType } from "@/lib/legislative/config";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
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
        <nav className="branch-links" aria-label="Document types">
          <Link href="/legislative/documents">All documents</Link>
          {["agenda", "minutes", "executive-order"].map((t) => (
            <Link key={t} href={`/legislative/documents?type=${t}`}>
              {isDocumentType(t) ? documentTypes[t] : t}
            </Link>
          ))}
        </nav>
        <div className="grid gap-6 md:grid-cols-2">
          {records.map((d) => (
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
        {!records.length && <p>No published documents found.</p>}
      </section>
    </>
  );
}
