import type { Metadata } from "next";
import { getNews } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { NewsDirectory } from "@/components/news/NewsDirectory";
export const metadata: Metadata = {
  title: "News & updates",
  description:
    "Municipal news, executive and legislative activities, and public announcements.",
};
export default async function Page() {
  return (
    <>
      <PageHero
        title="News & community updates"
        description="Stories, announcements, and activities from around our municipality."
      />
      <section className="container section">
        <PreviewNote />
        <NewsDirectory articles={await getNews()} />
      </section>
    </>
  );
}
