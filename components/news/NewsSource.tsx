import Link from "next/link";
import type { NewsArticle } from "@/types";
import { getNewsSource } from "@/lib/news/source";
export function NewsSource({ article }: { article: NewsArticle }) {
  const source = getNewsSource(article);
  return (
    <span className="news-source">
      {source.slug ? (
        <Link href={`/departments/${source.slug}`}>{source.name}</Link>
      ) : (
        source.name
      )}
    </span>
  );
}
