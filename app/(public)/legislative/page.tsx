import { publicTerm } from "@/lib/legislative/terms-server";
import { inTerm } from "@/lib/legislative/terms";
import { isLegislativeRole } from "@/lib/officials/roles";
import type { Metadata } from "next";
import Link from "next/link";
import { getOfficials, getSessions } from "@/lib/api";
import { PageHero, SectionHeader } from "@/components/shared/ui";
import { OfficialGrid } from "@/components/officials/OfficialGrid";
import { SessionCard } from "@/components/legislative/SessionCard";
export const metadata: Metadata = {
  title: "Sangguniang Bayan",
  description:
    "Municipal council members, sessions, ordinances, resolutions, committees, and public hearings.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const { selected } = await publicTerm((await searchParams).term);
  const [officials, sessions] = await Promise.all([
    getOfficials(),
    getSessions(),
  ]);
  return (
    <>
      <PageHero
        title="The Sangguniang Bayan"
        eyebrow="THE LEGISLATIVE BRANCH"
        description="Representing the people through responsive legislation, public deliberation, and accountable local governance."
      />
      <section className="container section legislative-content">
        <nav className="branch-links" aria-label="Legislative pages">
          {[
            ["Council members", "members"],
            ["Sessions", "sessions"],
            ["Ordinances", "ordinances"],
            ["Resolutions", "resolutions"],
            ["Documents", "documents"],
            ["Committees", "committees"],
            ["Public hearings", "public-hearings"],
          ].map(([n, h]) => (
            <Link key={h} href={`/legislative/${h}?term=${selected}`}>
              {n}
            </Link>
          ))}
        </nav>
        <SectionHeader
          eyebrow="YOUR MUNICIPAL COUNCIL"
          title="A voice for every community"
          href={`/legislative/members?term=${selected}`}
          linkText="View council per terms"
        />
        <OfficialGrid
          officials={officials.filter(
            (o) => isLegislativeRole(o.legislativeRole) && inTerm(o, selected),
          )}
        />
        <div className="mt-16">
          <SectionHeader
            eyebrow="LEGISLATIVE ACTIVITY"
            title="Recent council sessions"
            href={`/legislative/sessions?term=${selected}`}
          />
          <div className="grid gap-6 md:grid-cols-2">
            {sessions
              .filter((s) => inTerm(s, selected))
              .slice(0, 2)
              .map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
          </div>
        </div>
      </section>
    </>
  );
}
