import Link from "next/link";
import { Landmark, ShieldCheck, ArrowRight, ArrowUpRight } from "lucide-react";
import { SectionHeader } from "@/components/shared/ui";
import { OfficialGrid } from "@/components/officials/OfficialGrid";
import type { Official } from "@/types";
export function LeadershipSection({ officials }: { officials: Official[] }) {
  return (
    <>
      <section className="container section">
        <SectionHeader
          eyebrow="YOUR LOCAL GOVERNMENT"
          title="Leadership in service of the people"
          description="Two branches, one shared commitment to the people of Pinamungajan."
        />
        <div className="branch-grid">
          <Link href="/legislative" className="branch-card">
            <span className="branch-icon">
              <Landmark size={30} strokeWidth={1.4} />
            </span>
            <div>
              <span className="eyebrow">SANGGUNIANG BAYAN</span>
              <h3>The Legislative Branch</h3>
              <p>
                Local legislation, public deliberation, and a voice for every
                community.
              </p>
            </div>
            <ArrowUpRight size={23} />
          </Link>
          <Link href="/executive" className="branch-card">
            <span className="branch-icon">
              <ShieldCheck size={30} strokeWidth={1.4} />
            </span>
            <div>
              <span className="eyebrow">MUNICIPAL ADMINISTRATION</span>
              <h3>The Executive Branch</h3>
              <p>
                Turning our shared priorities into programs, projects, and
                public service.
              </p>
            </div>
            <ArrowUpRight size={23} />
          </Link>
        </div>
        <div className="directory-heading">
          <h3>Legislative leadership</h3>
          <Link className="text-link" href="/legislative/members">
            Meet the council
            <ArrowRight size={15} />
          </Link>
        </div>
        <OfficialGrid
          officials={officials.filter((o) => o.branch === "legislative")}
        />
        <div className="directory-heading">
          <h3>Executive leadership</h3>
          <Link className="text-link" href="/executive">
            Explore the executive
            <ArrowRight size={15} />
          </Link>
        </div>
        <OfficialGrid
          officials={officials.filter((o) => o.branch === "executive")}
        />
      </section>
    </>
  );
}
