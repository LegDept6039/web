import { getCollection } from "@/lib/content/repository";
import { publicTerm } from "@/lib/legislative/terms-server";
import { LeadershipSection } from "./LeadershipSection";
import { LatestNews } from "./LatestNews";
import { ServicesSection } from "./ServicesSection";
import { LegislativeUpdates } from "./LegislativeUpdates";
export async function HomeLeadership() {
  const [{ selected }, departments] = await Promise.all([
    publicTerm(),
    getCollection("departments", { parent_department_id: null }, 4),
  ]);
  const officials =
    selected === "none"
      ? []
      : await getCollection(
          "officials",
          { branch: "legislative", term_id: selected },
          4,
        );
  return <LeadershipSection officials={officials} departments={departments} />;
}
export async function HomeNews() {
  return <LatestNews news={await getCollection("news", {}, 3)} />;
}
export async function HomeServices() {
  return <ServicesSection services={await getCollection("services", {}, 4)} />;
}
export async function HomeUpdates() {
  const [sessions, programs] = await Promise.all([
    getCollection("sessions", {}, 2),
    getCollection("programs", { content_scope: "executive" }, 3),
  ]);
  return <LegislativeUpdates sessions={sessions} programs={programs} />;
}
