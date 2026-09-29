import type { Metadata } from "next";
import { getOrdinances } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { DocumentDirectory } from "@/components/legislative/DocumentDirectory";
export const metadata: Metadata = {
  title: "Ordinances",
  description:
    "Search municipal ordinances by title, number, author, and year.",
};
export default async function Page() {
  return (
    <>
      <PageHero
        title="Ordinances"
        eyebrow="SANGGUNIANG BAYAN • LEGISLATIVE RECORDS"
        description="Explore local measures and the decisions that shape our municipality."
      />
      <section className="container section">
        <PreviewNote />
        <DocumentDirectory
          kind="ordinances"
          documents={await getOrdinances()}
        />
      </section>
    </>
  );
}
