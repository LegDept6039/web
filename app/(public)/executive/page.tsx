import type { Metadata } from "next";
import Link from "next/link";
import { getDepartments, getNews, getPrograms } from "@/lib/api";
import { PageHero, PreviewNote, SectionHeader } from "@/components/shared/ui";
import { DepartmentGrid } from "@/components/departments/DepartmentGrid";
import { NewsGrid } from "@/components/news/NewsCard";
export const metadata: Metadata = {
  title: "Executive Department",
  description:
    "Municipal leadership, departments, programs, projects, and executive activities.",
};
export default async function Page() {
  const [departments, news, programs] = await Promise.all([
    getDepartments(),
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
            ["Departments", "department"],
            ["Programs & projects", "programs"],
            ["News and Activities", "activities"],
          ].map(([n, h]) => (
            <Link
              key={h}
              href={
                h === "department"
                  ? "/departments"
                  : h === "mayor"
                    ? "/mayor"
                    : h === "activities"
                      ? "/activities"
                      : `/executive/${h}`
              }
            >
              {n}
            </Link>
          ))}
        </nav>
        <SectionHeader
          eyebrow="MUNICIPAL LEADERSHIP"
          title="People at the heart of public service"
          href="/departments"
          linkText="View All Departments"
        />
        <DepartmentGrid portraits departments={departments.slice(0, 3)} />
        <div className="mt-16">
          <SectionHeader
            eyebrow="OUR SHARED PRIORITIES"
            title="Programs & projects"
            href="/executive/programs"
          />
          <div className="content-grid">
            {programs
              .filter((p) => p.contentScope !== "legislative")
              .slice(0, 3)
              .map((p) => (
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
            articles={news
              .filter((n) =>
                n.contentScope
                  ? n.contentScope === "executive"
                  : n.category !== "Legislative",
              )
              .slice(0, 3)}
          />
        </div>
      </section>
    </>
  );
}
