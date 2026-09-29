import type { Metadata } from "next";
import { getResolutions } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { DocumentDirectory } from "@/components/legislative/DocumentDirectory";
export const metadata: Metadata = {
  title: "Resolutions",
  description:
    "Search municipal resolutions by title, number, author, and year.",
};
export default async function Page() {
  return (
    <>
      <PageHero
        title="Resolutions"
        eyebrow="SANGGUNIANG BAYAN • LEGISLATIVE RECORDS"
        description="Explore local measures and the decisions that shape our municipality."
      />
      <section className="container section">
        <PreviewNote />
        <DocumentDirectory
          kind="resolutions"
          documents={await getResolutions()}
        />
      </section>
    </>
  );
}
