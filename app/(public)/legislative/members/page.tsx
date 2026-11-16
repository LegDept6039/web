import { isLegislativeRole } from "@/lib/officials/roles";
import type { Metadata } from "next";
import { getOfficials } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { OfficialGrid } from "@/components/officials/OfficialGrid";
export const metadata: Metadata = { title: "Sangguniang Bayan members" };
export default async function Page() {
  const officials = (await getOfficials()).filter((o) =>
    isLegislativeRole(o.legislativeRole),
  );
  return (
    <>
      <PageHero
        title="Your municipal council"
        eyebrow="SANGGUNIANG BAYAN"
        description="The Municipal Vice-Mayor, council members, and Secretary to the Sangguniang Bayan serving our community."
      />
      <section className="container section">
        {officials.some((o) => o.isSample) && (
          <PreviewNote>
            Directory structure only. The verified council roster, names,
            photographs, terms, and committee assignments will be supplied by
            the SB Secretariat.
          </PreviewNote>
        )}
        <OfficialGrid officials={officials} directory />
      </section>
    </>
  );
}
