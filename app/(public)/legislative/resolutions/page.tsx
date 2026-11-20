import { publicTerm } from "@/lib/legislative/terms-server";
import { inTerm, philippineDate } from "@/lib/legislative/terms";
import { TermSelector } from "@/components/legislative/TermSelector";
import type { Metadata } from "next";
import { getResolutions } from "@/lib/api";
import { PageHero } from "@/components/shared/ui";
import { DocumentDirectory } from "@/components/legislative/DocumentDirectory";
export const metadata: Metadata = {
  title: "Resolutions",
  description:
    "Search municipal resolutions by title, number, author, and year.",
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
        title="Resolutions"
        eyebrow="SANGGUNIANG BAYAN • LEGISLATIVE RECORDS"
        description="Explore local measures and the decisions that shape our municipality."
      />
      <section className="container section">
        <TermSelector
          terms={terms}
          selected={selected}
          today={philippineDate()}
        />
        <DocumentDirectory
          kind="resolutions"
          documents={(await getResolutions()).filter((d) =>
            inTerm(d, selected),
          )}
        />
      </section>
    </>
  );
}
