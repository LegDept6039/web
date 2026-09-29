import type { Metadata } from "next";
import { getNews } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { NewsDirectory } from "@/components/news/NewsDirectory";
export const metadata: Metadata = { title: "Executive activities" };
export default async function Page() {
  return (
    <>
      <PageHero
        title="Executive activities"
        description="Follow municipal initiatives, outreach, and public service updates."
      />
      <section className="container section">
        <PreviewNote />
        <NewsDirectory
          articles={(await getNews()).filter(
            (n) => n.category !== "Legislative",
          )}
        />
      </section>
    </>
  );
}
