import type { Metadata } from "next";
import { getSessions } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { SessionCard } from "@/components/legislative/SessionCard";
export const metadata: Metadata = {
  title: "Council sessions",
  description:
    "Regular sessions, special sessions, and caucus meetings of the Sangguniang Bayan.",
};
export default async function Page() {
  return (
    <>
      <PageHero
        title="Council sessions"
        eyebrow="SANGGUNIANG BAYAN"
        description="Follow the proceedings, discussions, and work of your municipal council."
      />
      <section className="container section">
        <PreviewNote />
        <div className="grid gap-6 md:grid-cols-2">
          {(await getSessions()).map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      </section>
    </>
  );
}
