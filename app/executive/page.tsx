import type { Metadata } from "next";
import Link from "next/link";
import { getOfficials, getNews, getPrograms } from "@/lib/api";
import { PageHero, PreviewNote, SectionHeader } from "@/components/shared/ui";
import { OfficialGrid } from "@/components/officials/OfficialGrid";
import { NewsGrid } from "@/components/news/NewsCard";
export const metadata: Metadata = {
  title: "Executive Department",
  description:
    "Municipal leadership, departments, programs, projects, and executive activities.",
};
export default async function Page() {
  const [officials, news, programs] = await Promise.all([
    getOfficials(),
    getNews(),
    getPrograms(),
  ]);
  return (
    <>
      <PageHero
        title="The Executive Department"
        eyebrow="LEADERSHIP THROUGH SERVICE"
        description="Implementing local priorities, delivering municipal services, and working for a progressive Pinamungajan."
      />
      <section className="container section">
        <PreviewNote>
          Official profiles and program information are placeholders awaiting
          municipal verification.
        </PreviewNote>
        <nav className="branch-links" aria-label="Executive pages">
          {[
            ["Municipal Mayor", "mayor"],
            ["Departments", "departments"],
            ["Programs & projects", "programs"],
            ["Activities", "activities"],
          ].map(([n, h]) => (
            <Link key={h} href={`/executive/${h}`}>
              {n}
            </Link>
          ))}
        </nav>
        <SectionHeader
          eyebrow="MUNICIPAL LEADERSHIP"
          title="People at the heart of public service"
        />
        <OfficialGrid
          officials={officials.filter((o) => o.branch === "executive")}
        />
        <div className="mt-16">
          <SectionHeader
            eyebrow="OUR SHARED PRIORITIES"
            title="Programs & projects"
            href="/executive/programs"
          />
          <div className="content-grid">
            {programs.map((p) => (
              <article className="info-card" key={p.id}>
                <span className="eyebrow">{p.category}</span>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <small>{p.status}</small>
              </article>
            ))}
          </div>
        </div>
        <div className="mt-16">
          <SectionHeader
            eyebrow="EXECUTIVE UPDATES"
            title="In service of the community"
            href="/executive/activities"
          />
          <NewsGrid
            articles={news.filter((n) =>
              ["Executive", "Health", "Announcements"].includes(n.category),
            )}
          />
        </div>
      </section>
    </>
  );
}
