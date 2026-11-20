import type { Metadata } from "next";
import { getPrograms } from "@/lib/api";
import { PageHero } from "@/components/shared/ui";
import { ProgramGrid } from "@/components/departments/DepartmentGrid";
export const metadata: Metadata = { title: "Programs & projects" };
export default async function Page() {
  return (
    <>
      <PageHero
        title="Programs & projects"
        description="Community priorities, municipal initiatives, and the work toward a better tomorrow."
      />
      <section className="container section">
        <ProgramGrid
          programs={(await getPrograms()).filter(
            (p) => p.contentScope !== "legislative",
          )}
        />
      </section>
    </>
  );
}
