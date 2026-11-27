import { ChevronDown, FileText } from "lucide-react";
import type { Service } from "@/types";
import { ServiceBody } from "@/components/services/ServiceBody";
import { ServiceFormDownload } from "@/components/services/ServiceFormDownload";

export function DepartmentServices({ services }: { services: Service[] }) {
  if (!services.length) return null;
  return (
    <section
      className="department-services mt-16"
      aria-labelledby="department-services-title"
    >
      <header className="department-services-heading">
        <h2 id="department-services-title">Department Services</h2>
        <p>Explore the services available from this office.</p>
      </header>
      <div className="department-service-list">
        {services.map((service) => {
          const body =
            service.body ||
            [service.description, ...service.steps].join("\n\n");
          const excerpt = body.trim().replace(/\s+/g, " ");
          const preview =
            excerpt.length > 180
              ? `${excerpt.slice(0, 180).replace(/\s+\S*$/, "")}…`
              : excerpt;
          return (
            <details className="department-service" key={service.id}>
              <summary>
                <span className="department-service-icon" aria-hidden="true">
                  <FileText size={20} strokeWidth={1.6} />
                </span>
                <h3>{service.name}</h3>
                <span className="department-service-preview">{preview}</span>
                <span className="department-service-toggle">
                  <span className="department-service-show">View details</span>
                  <span className="department-service-hide">Hide details</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </span>
              </summary>
              <ServiceBody body={body} richBody={service.richBody} />
              <ServiceFormDownload service={service} />
            </details>
          );
        })}
      </div>
    </section>
  );
}
