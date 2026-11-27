import { publicTerm } from "@/lib/legislative/terms-server";
import { philippineDate } from "@/lib/legislative/terms";
import { TermSelector } from "@/components/legislative/TermSelector";
import type { Metadata } from "next";
import { getResolutionArchive } from "@/lib/legislative/resolution-archive-server";
import { PageHero } from "@/components/shared/ui";
import { ResolutionArchive } from "@/components/legislative/ResolutionArchive";
export const metadata: Metadata = {
  title: "Resolutions",
  description:
    "Search municipal resolutions by title, number, author, and year.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) =>
    typeof params[key] === "string" ? params[key] : undefined;
  const { terms, selected } = await publicTerm(value("term"));
  const result = await getResolutionArchive({
    term: selected,
    year: value("year"),
    q: value("q"),
    page: value("page"),
  });
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
        <ResolutionArchive result={result} term={selected} />
      </section>
    </>
  );
}
