import Link from "next/link";
import type { NewsArticle } from "@/types";
export function NewsSource({ article }: { article: NewsArticle }) {
  if (!article.source) return null;
  return (
    <span className="news-source">
      {article.source.slug ? (
        <Link href={`/departments/${article.source.slug}`}>
          {article.source.name}
        </Link>
      ) : (
        article.source.name
      )}
    </span>
  );
}
