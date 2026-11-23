import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/shared/ui";
import { BarangayImage } from "@/components/barangays/BarangayImage";
import { RichText } from "@/components/shared/RichText";
import { getBarangays } from "@/lib/barangays/server";
import { barangayExcerpt } from "@/lib/barangays/validation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const barangay = (await getBarangays((await params).slug))?.[0];
  return {
    title: barangay?.name || "Barangay not found",
    description: barangay?.body.trim()
      ? barangayExcerpt(barangay.body)
      : undefined,
  };
}
export default async function BarangayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const barangay = (await getBarangays((await params).slug))?.[0];
  if (!barangay) notFound();
  return (
    <>
      <PageHero
        title={barangay.name}
        eyebrow="BARANGAY OF PINAMUNGAJAN"
        description="Our community, our people, our local leadership."
      />
      <section className="container section barangay-content">
        <Link className="text-link" href="/barangays">
          All barangays
        </Link>
        <div className="barangay-detail">
          <div>
            <BarangayImage src={barangay.image_url} name={barangay.name} />
            {barangay.captain_name.trim() && (
              <div className="barangay-leadership">
                <p className="eyebrow">BARANGAY CAPTAIN</p>
                <h2>{barangay.captain_name}</h2>
              </div>
            )}
          </div>
          {barangay.body.trim() ? (
            <div className="barangay-body">
              <RichText
                document={barangay.rich_body || undefined}
                legacy={barangay.body}
              />
            </div>
          ) : (
            <p className="barangay-empty">
              More information will be added soon.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
