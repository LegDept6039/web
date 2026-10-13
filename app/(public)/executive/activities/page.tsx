import type { Metadata } from "next";
import { getNews, getDepartments } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { NewsDirectory } from "@/components/news/NewsDirectory";
export const metadata: Metadata = { title: "Executive News and Activities" };
export default async function Page() {
  const [news, departments] = await Promise.all([getNews(), getDepartments()]);
  return (
    <>
      <PageHero
        title="Executive News and Activities"
        description="Follow municipal initiatives, outreach, and public service updates."
      />
      <section className="container section">
        <PreviewNote />
        <NewsDirectory
          departments={departments}
          articles={news.filter((n) =>
            n.contentScope
              ? n.contentScope === "executive"
              : n.category !== "Legislative",
          )}
        />
      </section>
    </>
  );
}
