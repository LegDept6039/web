import { getDepartments } from "@/lib/api";
import { PageHero } from "@/components/shared/ui";
import { DepartmentGrid } from "@/components/departments/DepartmentGrid";
export const metadata = { title: "Municipal departments" };
export default async function Page() {
  const departments = await getDepartments();
  const topLevel = departments.filter((d) => !d.parentDepartmentId);
  const branches = departments.filter((d) => d.parentDepartmentId);
  return (
    <>
      <PageHero
        title="Municipal departments"
        description="Working together to deliver the services our community needs."
      />
      <section className="container section">
        <h2 className="mb-6">Departments</h2>
        <DepartmentGrid portraits departments={topLevel} />
        {branches.length > 0 && (
          <section
            className="mt-16"
            aria-labelledby="department-branches-heading"
          >
            <h2 className="mb-6" id="department-branches-heading">
              Branches
            </h2>
            <DepartmentGrid portraits departments={branches} />
          </section>
        )}
      </section>
    </>
  );
}
