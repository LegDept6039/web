import { Suspense } from "react";
import { SectionLoading } from "@/components/shared/SectionLoading";
import {
  HomeLeadership,
  HomeNews,
  HomeServices,
  HomeUpdates,
} from "@/components/home/HomeContent";
import { Hero } from "@/components/home/Hero";
import { AnnouncementBanner } from "@/components/home/AnnouncementBanner";
import { MunicipalIntroduction } from "@/components/home/MunicipalIntroduction";
import { TourismFeature } from "@/components/home/TourismFeature";
import { TransparencyBanner } from "@/components/home/TransparencyBanner";
export default async function Home() {
  return (
    <>
      <Hero />
      <AnnouncementBanner />
      <MunicipalIntroduction />
      <TourismFeature />
      <Suspense fallback={<SectionLoading cards={4} rows={2} />}>
        <HomeLeadership />
      </Suspense>
      <Suspense fallback={<SectionLoading cards={3} />}>
        <HomeNews />
      </Suspense>
      <Suspense fallback={<SectionLoading cards={4} />}>
        <HomeServices />
      </Suspense>
      <Suspense fallback={<SectionLoading cards={2} />}>
        <HomeUpdates />
      </Suspense>
      <TransparencyBanner />
    </>
  );
}
