import { publicTerm } from "@/lib/legislative/terms-server";
import { inTerm, philippineDate } from "@/lib/legislative/terms";
import { TermSelector } from "@/components/legislative/TermSelector";
import { isLegislativeRole } from "@/lib/officials/roles";
import type { Metadata } from "next";
import { getOfficials } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { OfficialGrid } from "@/components/officials/OfficialGrid";
export const metadata: Metadata = { title: "Sangguniang Bayan members" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const [{ terms, selected }, allOfficials] = await Promise.all([
    publicTerm((await searchParams).term),
    getOfficials(),
  ]);
  const officials = allOfficials.filter(
    (o) => isLegislativeRole(o.legislativeRole) && inTerm(o, selected),
  );
  return (
    <div className="council-page">
      <PageHero
        title="Your Municipal Council"
        eyebrow="SANGGUNIANG BAYAN"
        description="The Municipal Vice-Mayor, council members, and Secretary to the Sangguniang Bayan serving our community."
      />
      <section
        className="container council-content"
        aria-labelledby="council-directory-title"
      >
        <div className="council-toolbar">
          <div className="council-directory-heading">
            <h2 id="council-directory-title">Council directory</h2>
            <p>
              {officials.length}{" "}
              {officials.length === 1 ? "official" : "officials"} in this
              selection
            </p>
          </div>
          <TermSelector
            terms={terms}
            selected={selected}
            today={philippineDate()}
            compact
          />
        </div>
        {officials.some((o) => o.isSample) && (
          <PreviewNote>
            Directory structure only. The verified council roster, names,
            photographs, terms, and committee assignments will be supplied by
            the SB Secretariat.
          </PreviewNote>
        )}
        {officials.length ? (
          <OfficialGrid officials={officials} directory />
        ) : (
          <p className="council-empty">
            No officials are published for this selection. Choose another
            Legislative Term to browse its roster.
          </p>
        )}
      </section>
    </div>
  );
}
