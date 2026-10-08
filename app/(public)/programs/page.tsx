import { getPrograms } from "@/lib/api";
import { PageHero } from "@/components/shared/ui";
import { ProgramGrid } from "@/components/departments/DepartmentGrid";
export const metadata = { title: "Programs & projects" };
export default async function Programs() {
  const programs = await getPrograms();
  return (
    <>
      <PageHero
        title="Programs & projects"
        description="Municipal initiatives and community programs."
      />
      <section className="container section">
        {programs.length ? (
          <ProgramGrid programs={programs} />
        ) : (
          <p>No programs have been published yet.</p>
        )}
      </section>
    </>
  );
}
