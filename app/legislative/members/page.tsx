import type { Metadata } from "next";
import { getOfficials } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { OfficialGrid } from "@/components/officials/OfficialGrid";
export const metadata: Metadata = { title: "Sangguniang Bayan members" };
export default async function Page() {
  return (
    <>
      <PageHero
        title="Your municipal council"
        eyebrow="SANGGUNIANG BAYAN"
        description="The Vice Mayor, council members, committees, and secretariat serving our community."
      />
      <section className="container section">
        <PreviewNote>
          Directory structure only. The verified council roster, names,
          photographs, terms, and committee assignments will be supplied by the
          SB Secretariat.
        </PreviewNote>
        <OfficialGrid
          officials={(await getOfficials()).filter(
            (o) => o.branch === "legislative",
          )}
        />
      </section>
    </>
  );
}
