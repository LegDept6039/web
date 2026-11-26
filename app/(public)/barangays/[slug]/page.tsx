import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/shared/ui";
import { BarangayImage } from "@/components/barangays/BarangayImage";
import { BarangayMap } from "@/components/barangays/BarangayMap";
import { RichText } from "@/components/shared/RichText";
import { getBarangays, getBarangayNews } from "@/lib/barangays/server";
import { barangayExcerpt } from "@/lib/barangays/validation";
import { NewsGrid } from "@/components/news/NewsCard";

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
  const news = await getBarangayNews(barangay.id);
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
        <div className="barangay-detail barangay-detail-with-map">
          <div className="barangay-detail-picture">
            <BarangayImage src={barangay.image_url} name={barangay.name} />
          </div>
          <div className="barangay-detail-content">
            {barangay.captain_name.trim() && (
              <div className="barangay-leadership">
                <p className="eyebrow">BARANGAY CAPTAIN</p>
                <h2>{barangay.captain_name}</h2>
              </div>
            )}
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
          <BarangayMap name={barangay.name} slug={barangay.slug} />
        </div>
        <section className="mt-16" aria-labelledby="barangay-news-title">
          <h2 id="barangay-news-title" className="mb-6">
            Barangay news
          </h2>
          {news.length ? (
            <NewsGrid articles={news} compact />
          ) : (
            <p>No news has been published for this barangay yet.</p>
          )}
        </section>
      </section>
    </>
  );
}
