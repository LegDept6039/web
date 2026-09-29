import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getServices } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { ServiceIcon } from "@/components/shared/ServiceIcon";
export const metadata: Metadata = {
  title: "Municipal services",
  description:
    "Find municipal offices and general guidance for local public services.",
};
export default async function Page() {
  return (
    <>
      <PageHero
        title="Here to serve you"
        eyebrow="MUNICIPAL SERVICES"
        description="Find the right office, understand the next step, and connect with your local government."
      />
      <section className="container section">
        <PreviewNote>
          Service guides are general placeholders. Confirm requirements, fees,
          and schedules with the responsible office.
        </PreviewNote>
        <div className="content-grid">
          {(await getServices()).map((s) => (
            <article className="info-card" key={s.id}>
              <span className="service-icon">
                <ServiceIcon name={s.icon} />
              </span>
              <h2>{s.name}</h2>
              <p>{s.description}</p>
              <Link href={`/services/${s.id}`} className="text-link">
                Learn more
                <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
