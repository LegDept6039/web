import { publicTerm } from "@/lib/legislative/terms-server";
import { inTerm, philippineDate } from "@/lib/legislative/terms";
import { TermSelector } from "@/components/legislative/TermSelector";
import type { Metadata } from "next";
import { getSessions } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { SessionCard } from "@/components/legislative/SessionCard";
export const metadata: Metadata = {
  title: "Council sessions",
  description:
    "Regular sessions, special sessions, and caucus meetings of the Sangguniang Bayan.",
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
        title="Council sessions"
        eyebrow="SANGGUNIANG BAYAN"
        description="Follow the proceedings, discussions, and work of your municipal council."
      />
      <section className="container section">
        <TermSelector
          terms={terms}
          selected={selected}
          today={philippineDate()}
        />
        <PreviewNote />
        <div className="grid gap-6 md:grid-cols-2">
          {(await getSessions())
            .filter((s) => inTerm(s, selected))
            .map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
        </div>
      </section>
    </>
  );
}
