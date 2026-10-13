import { getCollection } from "@/lib/content/repository";
import { LeadershipSection } from "./LeadershipSection";
import { LatestNews } from "./LatestNews";
import { ServicesSection } from "./ServicesSection";
import { LegislativeUpdates } from "./LegislativeUpdates";
export async function HomeLeadership() {
  const [officials, departments] = await Promise.all([
    getCollection("officials", { branch: "legislative" }, 4),
    getCollection("departments", {}, 4),
  ]);
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
