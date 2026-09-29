import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import { getDocumentCategories } from "@/lib/api/transparency";
import { PageHero, PreviewNote } from "@/components/shared/ui";
export const metadata: Metadata = {
  title: "Transparency portal",
  description:
    "Access financial disclosures, legislative records, and municipal document categories.",
};
export default async function Page() {
  return (
    <>
      <PageHero
        title="Open governance. Public trust."
        eyebrow="TRANSPARENCY PORTAL"
        description="Your starting point for municipal records, financial disclosures, and public information."
      />
      <section className="container section">
        <PreviewNote>
          This preview contains sample legislative records. Verified disclosure,
          budget, and procurement documents have not yet been published.
        </PreviewNote>
        <div className="content-grid">
          {(await getDocumentCategories()).map((c) => (
            <article className="info-card" key={c.id}>
              <span className="service-icon">
                <FileText size={26} />
              </span>
              <h2>{c.name}</h2>
              <p>{c.description}</p>
              <Link
                className="text-link"
                href={c.href ?? `/transparency/${c.id}`}
              >
                Browse category
                <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
