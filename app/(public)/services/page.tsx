import type { Metadata } from "next";
import { getDepartments, getServices } from "@/lib/api";
import { PageHero } from "@/components/shared/ui";
import { ServiceDirectory } from "@/components/services/ServiceDirectory";
export const metadata: Metadata = {
  title: "Municipal services",
  description:
    "Find municipal offices and general guidance for local public services.",
};
export default async function Page() {
  const [services, departments] = await Promise.all([
    getServices(),
    getDepartments(),
  ]);
  const serviceDepartmentIds = new Set(services.map((service) => service.officeId));
  const departmentOptions = departments
    .filter((department) =>
      serviceDepartmentIds.has(department.officeId || department.id),
    )
    .map((department) => ({
      id: department.officeId || department.id,
      name: department.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const departmentNames = new Map(
    departmentOptions.map((department) => [department.id, department.name]),
  );

  return (
    <>
      <PageHero
        title="Here to serve you"
        eyebrow="MUNICIPAL SERVICES"
        description="Find the right office, understand the next step, and connect with your local government."
      />
      <section className="container section service-directory-section">
        <ServiceDirectory
          departments={departmentOptions}
          services={services.map((service) => ({
            id: service.id,
            name: service.name,
            description: service.description,
            icon: service.icon,
            departmentId: service.officeId,
            departmentName:
              departmentNames.get(service.officeId || "") || service.office,
          }))}
        />
      </section>
    </>
  );
}
