import type { Metadata } from "next";
import Link from "next/link";
import { UserRound, ArrowRight } from "lucide-react";
import { PageHero, PreviewNote } from "@/components/shared/ui";
export const metadata: Metadata = { title: "Office of the Municipal Mayor" };
export default function Page() {
  return (
    <>
      <PageHero
        title="Office of the Municipal Mayor"
        description="Leadership committed to responsive service and shared progress."
      />
      <section className="container section">
        <PreviewNote>
          The verified name, portrait, biography, and message of the Municipal
          Mayor will be supplied by the municipality.
        </PreviewNote>
        <div className="contact-grid">
          <div className="official-portrait" style={{ height: 360 }}>
            <UserRound size={150} />
            <span>OFFICIAL PORTRAIT TO BE PROVIDED</span>
          </div>
          <div>
            <span className="eyebrow">MUNICIPAL MAYOR</span>
            <h2>Serving the people of Pinamungajan</h2>
            <p className="body-copy mt-5">
              The Office of the Municipal Mayor leads the executive branch,
              oversees the delivery of municipal services, and coordinates the
              implementation of local programs and development priorities.
            </p>
            <p className="body-copy mt-5">
              This profile is prepared for the official biography, priorities,
              and message to the community.
            </p>
            <Link href="/executive/programs" className="text-link mt-8">
              Explore programs & projects
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
