import { publicTerm } from "@/lib/legislative/terms-server";
import { inTerm, philippineDate } from "@/lib/legislative/terms";
import { TermSelector } from "@/components/legislative/TermSelector";
import type { Metadata } from "next";
import { getOrdinances } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { DocumentDirectory } from "@/components/legislative/DocumentDirectory";
export const metadata: Metadata = {
  title: "Ordinances",
  description:
    "Search municipal ordinances by title, number, author, and year.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const { terms, selected } = await publicTerm((await searchParams).term);
  return (
    <>
      <PageHero
        title="Ordinances"
        eyebrow="SANGGUNIANG BAYAN • LEGISLATIVE RECORDS"
        description="Explore local measures and the decisions that shape our municipality."
      />
      <section className="container section">
        <TermSelector
          terms={terms}
          selected={selected}
          today={philippineDate()}
        />
        <PreviewNote />
        <DocumentDirectory
          kind="ordinances"
          documents={(await getOrdinances()).filter((d) => inTerm(d, selected))}
        />
      </section>
    </>
  );
}
