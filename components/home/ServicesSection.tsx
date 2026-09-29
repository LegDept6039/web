import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHeader } from "@/components/shared/ui";
import { ServiceIcon } from "@/components/shared/ServiceIcon";
import type { Service } from "@/types";
export function ServicesSection({ services }: { services: Service[] }) {
  return (
    <>
      <section className="container section">
        <div className="service-heading">
          <SectionHeader
            eyebrow="HOW CAN WE HELP?"
            title="Public service starts here"
            description="Find the information and the office you need."
          />
          <Link href="/services" className="text-link">
            All municipal services
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="service-shortcuts">
          {services.slice(0, 4).map((s) => (
            <Link href={`/services/${s.id}`} key={s.id}>
              <span className="service-icon">
                <ServiceIcon name={s.icon} />
              </span>
              <h3>{s.name}</h3>
              <p>{s.description}</p>
              <span className="text-link">
                Learn more
                <ArrowRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
