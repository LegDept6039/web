import type { Metadata } from "next";
import { getNews, getOrdinances, getResolutions, getServices } from "@/lib/api";
import { PageHero } from "@/components/shared/ui";
import { SiteSearch, type SearchRecord } from "@/components/shared/SiteSearch";
export const metadata: Metadata = { title: "Search the municipal portal" };
export default async function Page() {
  const [news, ordinances, resolutions, services] = await Promise.all([
    getNews(),
    getOrdinances(),
    getResolutions(),
    getServices(),
  ]);
  const records: SearchRecord[] = [
    ...news.map((n) => ({
      id: n.slug,
      title: n.title,
      category: "Sample news",
      href: `/news/${n.slug}`,
      description: n.excerpt,
    })),
    ...ordinances.map((d) => ({
      id: `ord-${d.id}`,
      title: `Ordinance ${d.number}: ${d.title}`,
      category: "Sample ordinance",
      href: `/legislative/ordinances/${d.id}`,
      description: d.summary,
    })),
    ...resolutions.map((d) => ({
      id: `res-${d.id}`,
      title: `Resolution ${d.number}: ${d.title}`,
      category: "Sample resolution",
      href: `/legislative/resolutions/${d.id}`,
      description: d.summary,
    })),
    ...services.map((s) => ({
      id: s.id,
      title: s.name,
      category: "Municipal service",
      href: `/services/${s.id}`,
      description: s.description,
    })),
  ];
  return (
    <>
      <PageHero
        title="What can we help you find?"
        eyebrow="SEARCH THE MUNICIPAL PORTAL"
        description="Find service information, sample legislative records, and municipal updates."
      />
      <section className="container section">
        <SiteSearch records={records} />
      </section>
    </>
  );
}
