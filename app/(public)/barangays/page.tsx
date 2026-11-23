import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHero } from "@/components/shared/ui";
import { BarangayImage } from "@/components/barangays/BarangayImage";
import { getBarangays } from "@/lib/barangays/server";
import { barangayExcerpt } from "@/lib/barangays/validation";

export const metadata = { title: "Barangays" };
export default async function BarangaysPage() {
  let barangays: Awaited<ReturnType<typeof getBarangays>> = null;
  let failed = false;
  try {
    barangays = await getBarangays();
  } catch {
    failed = true;
  }
  return (
    <>
      <PageHero
        title="Our Barangays"
        eyebrow="COMMUNITIES OF PINAMUNGAJAN"
        description="Meet our barangay leaders and learn about the communities that make up our municipality."
      />
      <section
        className="container section barangay-content"
        aria-label="Barangay directory"
      >
        <p className="mb-6">
          <Link className="text-link" href="/sk">
            View SK directory <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </p>
        {failed ? (
          <p role="alert">
            Unable to load barangay information. Please try again later.
          </p>
        ) : barangays?.length ? (
          <div className="barangay-grid">
            {barangays.map((barangay) => (
              <article className="barangay-card" key={barangay.id}>
                <div className="barangay-card-image">
                  <BarangayImage
                    src={barangay.image_url}
                    name={barangay.name}
                  />
                </div>
                <div className="barangay-card-body">
                  <h2>
                    <Link href={`/barangays/${barangay.slug}`}>
                      {barangay.name}
                    </Link>
                  </h2>
                  {barangay.captain_name.trim() && (
                    <p className="barangay-captain">
                      <span>Barangay Captain</span>
                      {barangay.captain_name}
                    </p>
                  )}
                  {barangay.body.trim() && (
                    <p className="barangay-excerpt">
                      {barangayExcerpt(barangay.body)}
                    </p>
                  )}
                  <Link
                    className="text-link"
                    href={`/barangays/${barangay.slug}`}
                  >
                    View barangay <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="barangay-empty">
            Barangay profiles will appear here once they are published.
          </p>
        )}
      </section>
    </>
  );
}
