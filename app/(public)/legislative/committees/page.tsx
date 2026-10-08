import type { Metadata } from "next";
import { getCommittees } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
export const metadata: Metadata = { title: "Standing committees" };
export default async function Page() {
  return (
    <>
      <PageHero
        title="Standing committees"
        eyebrow="SANGGUNIANG BAYAN"
        description="Focused review, informed discussion, and community consultation."
      />
      <section className="container section">
        <PreviewNote>
          Sample committee structure. Official committee names, membership, and
          assignments are to be confirmed.
        </PreviewNote>
        <div className="content-grid">
          {(await getCommittees()).map((c) => (
            <article className="info-card" key={c.id}>
              <span className="eyebrow">LEGISLATIVE COMMITTEE</span>
              <h2>{c.name}</h2>
              <p>{c.responsibility}</p>
              <small>{c.chair}</small>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
