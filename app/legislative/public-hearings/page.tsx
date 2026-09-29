import type { Metadata } from "next";
import { CalendarDays, MapPin, Users, FileText } from "lucide-react";
import { getHearings } from "@/lib/api";
import { PageHero, PreviewNote, SectionHeader } from "@/components/shared/ui";
import { formatDate } from "@/lib/utils";
export const metadata: Metadata = { title: "Public hearings" };
export default async function Page() {
  const hearings = await getHearings();
  return (
    <>
      <PageHero
        title="Your voice matters"
        eyebrow="PUBLIC HEARINGS & CONSULTATIONS"
        description="Learn about public consultations and the local measures being discussed."
      />
      <section className="container section">
        <PreviewNote>
          All hearings below are fictional examples. These dates are not
          invitations to actual events.
        </PreviewNote>
        {(["Upcoming", "Previous"] as const).map((status) => (
          <div key={status} className="mb-12">
            <SectionHeader
              eyebrow="PUBLIC PARTICIPATION"
              title={`${status} hearings`}
            />
            <div className="grid md:grid-cols-2 gap-6">
              {hearings
                .filter((h) => h.status === status)
                .map((h) => (
                  <article className="info-card" key={h.id}>
                    <span className="eyebrow">{h.status} · Sample</span>
                    <h3>{h.title}</h3>
                    <div className="hearing-meta">
                      <span>
                        <CalendarDays size={16} />
                        {formatDate(h.date)}
                      </span>
                      <span>
                        <MapPin size={16} />
                        {h.venue}
                      </span>
                      <span>
                        <Users size={16} />
                        {h.sectors}
                      </span>
                      <span>
                        <FileText size={16} />
                        {h.relatedOrdinance}
                      </span>
                    </div>
                  </article>
                ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
