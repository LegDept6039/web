import type { Metadata } from "next";
import { getCommittees, getOfficials } from "@/lib/api";
import { CommitteeDirectory } from "@/components/officials/CommitteeDirectory";
import { PageHero, PreviewNote } from "@/components/shared/ui";
export const metadata: Metadata = { title: "Standing committees" };
export default async function Page() {
  const [committees, officials] = await Promise.all([
    getCommittees(),
    getOfficials(),
  ]);
  const names = new Map(
    officials.map((official) => [official.id, official.name]),
  );
  const directory = committees.map((committee) => ({
    id: committee.id,
    name: committee.name,
    responsibility: committee.responsibility,
    chair: committee.chairId
      ? names.get(committee.chairId) || ""
      : committee.chair,
    viceChair: names.get(committee.viceChairId || "") || "",
    members: [
      committee.member1Id,
      committee.member2Id,
      committee.member3Id,
      committee.member4Id,
    ]
      .map((id) => names.get(id || ""))
      .filter((name): name is string => Boolean(name)),
  }));
  return (
    <>
      <PageHero
        title="Standing committees"
        eyebrow="SANGGUNIANG BAYAN"
        description="Focused review, informed discussion, and community consultation."
      />
      <section className="container section">
        {committees.some((committee) => committee.isSample) && (
          <PreviewNote>
            Sample committee structure. Official committee names, membership,
            and assignments are to be confirmed.
          </PreviewNote>
        )}
        <CommitteeDirectory committees={directory} />
      </section>
    </>
  );
}
