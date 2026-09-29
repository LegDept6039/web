import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { getDepartments } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
export const metadata: Metadata = { title: "Municipal departments" };
export default async function Page() {
  return (
    <>
      <PageHero
        title="Municipal departments"
        description="Working together to deliver the services our community needs."
      />
      <section className="container section">
        <PreviewNote>
          Sample department directory. Office heads and verified contact details
          are awaiting publication.
        </PreviewNote>
        <div className="content-grid">
          {(await getDepartments()).map((d) => (
            <article className="info-card" key={d.id}>
              <Building2 className="mb-5" />
              <h2>{d.name}</h2>
              <p>{d.description}</p>
              <Link className="text-link" href="/contact">
                Office information
                <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
