import { getDepartments } from "@/lib/api";
import { PageHero } from "@/components/shared/ui";
import { DepartmentGrid } from "@/components/departments/DepartmentGrid";
export const metadata = { title: "Municipal departments" };
export default async function Page() {
  return (
    <>
      <PageHero
        title="Municipal departments"
        description="Working together to deliver the services our community needs."
      />
      <section className="container section">
        <DepartmentGrid departments={await getDepartments()} />
      </section>
    </>
  );
}
