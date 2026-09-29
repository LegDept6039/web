import { SectionHeader } from "@/components/shared/ui";
import { NewsGrid } from "@/components/news/NewsCard";
import type { NewsArticle } from "@/types";
export function LatestNews({ news }: { news: NewsArticle[] }) {
  return (
    <>
      <section className="light-section section">
        <div className="container">
          <SectionHeader
            eyebrow="AROUND THE MUNICIPALITY"
            title="News & community updates"
            href="/news"
            linkText="All news & updates"
          />
          <NewsGrid articles={news.slice(0, 3)} />
        </div>
      </section>
    </>
  );
}
