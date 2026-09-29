import {
  getNews,
  getOfficials,
  getServices,
  getPrograms,
  getSessions,
} from "@/lib/api";
import { Hero } from "@/components/home/Hero";
import { AnnouncementBanner } from "@/components/home/AnnouncementBanner";
import { MunicipalIntroduction } from "@/components/home/MunicipalIntroduction";
import { TourismFeature } from "@/components/home/TourismFeature";
import { LeadershipSection } from "@/components/home/LeadershipSection";
import { LatestNews } from "@/components/home/LatestNews";
import { ServicesSection } from "@/components/home/ServicesSection";
import { LegislativeUpdates } from "@/components/home/LegislativeUpdates";
import { TransparencyBanner } from "@/components/home/TransparencyBanner";
export default async function Home() {
  const [news, officials, services, programs, sessions] = await Promise.all([
    getNews(),
    getOfficials(),
    getServices(),
    getPrograms(),
    getSessions(),
  ]);
  return (
    <>
      <Hero />
      <AnnouncementBanner />
      <MunicipalIntroduction />
      <TourismFeature />
      <LeadershipSection officials={officials} />
      <LatestNews news={news} />
      <ServicesSection services={services} />
      <LegislativeUpdates sessions={sessions} programs={programs} />
      <TransparencyBanner />
    </>
  );
}
