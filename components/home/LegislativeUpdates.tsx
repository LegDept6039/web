import Link from "next/link";
import { CalendarDays, ArrowRight, ArrowUpRight } from "lucide-react";
import { SectionHeader } from "@/components/shared/ui";
import { formatDate } from "@/lib/utils";
import type { Session, Program } from "@/types";
export function LegislativeUpdates({
  sessions,
  programs,
}: {
  sessions: Session[];
  programs: Program[];
}) {
  return (
    <>
      <section className="light-section section">
        <div className="container activity-grid">
          <div>
            <SectionHeader
              eyebrow="OPEN & ACCOUNTABLE"
              title="Inside the Sangguniang Bayan"
              href="/legislative/sessions"
              linkText="All sessions"
            />
            {sessions.slice(0, 2).map((s) => (
              <Link
                href="/legislative/sessions"
                className="session-row"
                key={s.id}
              >
                <span className="session-date">
                  <CalendarDays size={23} />
                </span>
                <div>
                  <span className="meta">
                    {formatDate(s.date)} · Sample session
                  </span>
                  <h3>
                    {s.number} {s.type}
                  </h3>
                  <p>17th Sangguniang Bayan</p>
                </div>
                <ArrowUpRight size={18} />
              </Link>
            ))}
            <div className="record-shortcuts">
              <Link href="/legislative/ordinances">
                Browse ordinances
                <ArrowRight size={16} />
              </Link>
              <Link href="/legislative/resolutions">
                Browse resolutions
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          <div className="program-panel">
            <span className="eyebrow">BUILDING A BETTER TOMORROW</span>
            <h2>Programs & projects</h2>
            {programs.map((p, i) => (
              <Link
                href="/executive/programs"
                key={p.id}
                className="program-row"
              >
                <span>0{i + 1}</span>
                <div>
                  <small>{p.category}</small>
                  <h3>{p.name}</h3>
                </div>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
