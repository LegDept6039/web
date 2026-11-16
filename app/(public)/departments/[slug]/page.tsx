import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getDepartment, getDepartmentContent } from "@/lib/api";
import { PageHero } from "@/components/shared/ui";
import { OfficialPhoto } from "@/components/officials/OfficialPhoto";
import { NewsGrid } from "@/components/news/NewsCard";
import { ProgramGrid } from "@/components/departments/DepartmentGrid";
import { DepartmentContacts } from "@/components/departments/DepartmentContacts";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const d = await getDepartment((await params).slug);
  return {
    title: d?.name || "Department not found",
    description: d?.description,
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = await getDepartment(slug);
  if (!d) notFound();
  if (d.slug && slug !== d.slug) permanentRedirect(`/departments/${d.slug}`);
  const { news, programs, contacts } = await getDepartmentContent(
    d.officeId || d.id,
  );
  return (
    <>
      <PageHero
        description=""
        title={d.name}
        eyebrow={d.acronym || "MUNICIPAL DEPARTMENT"}
      />
      <section className="container section department-detail">
        <Link className="text-link" href="/departments">
          All departments
        </Link>
        <section
          className="department-profile"
          aria-label="Department head and overview"
        >
          <div className="department-photo">
            <OfficialPhoto
              src={d.headPhoto}
              name={d.headName || "Department head"}
              sizes="(max-width: 600px) 85vw, 300px"
            />
          </div>
          <div>
            {d.headTitle && (
              <p className="department-head-title">{d.headTitle}</p>
            )}
            {d.headName && <h2>{d.headName}</h2>}
            {d.description && (
              <p className="department-description">{d.description}</p>
            )}
            {d.headDescription && (
              <p className="department-biography">{d.headDescription}</p>
            )}
          </div>
        </section>
        <section className="mt-16">
          <h2>About the Department</h2>
          <div className="department-body">
            {(d.body || d.description)
              .split(/\r?\n/)
              .filter(Boolean)
              .map((p, i) => (
                <p key={i}>{p}</p>
              ))}
          </div>
        </section>
        <section className="mt-16">
          <h2 className="mb-6">Department news</h2>
          {news.length ? (
            <NewsGrid articles={news} compact />
          ) : (
            <p>No news has been published by this department yet.</p>
          )}
        </section>
        <section className="mt-16">
          <h2 className="mb-6">Department programs</h2>
          {programs.length ? (
            <ProgramGrid programs={programs} />
          ) : (
            <p>No programs have been published by this department yet.</p>
          )}
        </section>
        <DepartmentContacts contacts={contacts} />
      </section>
    </>
  );
}
