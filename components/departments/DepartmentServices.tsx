import { ChevronDown } from "lucide-react";
import type { Service } from "@/types";
import { ServiceBody } from "@/components/services/ServiceBody";

export function DepartmentServices({ services }: { services: Service[] }) {
  if (!services.length) return null;
  return (
    <section
      className="department-services mt-16"
      aria-labelledby="department-services-title"
    >
      <h2 id="department-services-title" className="mb-6">
        Department Services
      </h2>
      <div className="department-service-list">
        {services.map((service) => (
          <details className="department-service" key={service.id}>
            <summary>
              <h3>{service.name}</h3>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <ServiceBody
              body={
                service.body ||
                [service.description, ...service.steps].join("\n\n")
              }
            />
          </details>
        ))}
      </div>
    </section>
  );
}
