import { NewsSource } from "./NewsSource";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { NewsArticle } from "@/types";
import { formatDate } from "@/lib/utils";
export function NewsCard({
  article,
  compact = false,
}: {
  article: NewsArticle;
  compact?: boolean;
}) {
  return (
    <article className={compact ? "news-card news-card-compact" : "news-card"}>
      <Link href={`/news/${article.slug}`} className="news-image">
        <Image
          src={article.image}
          alt={article.title}
          fill
          sizes={
            compact
              ? "(max-width: 699px) 100vw, (max-width: 1099px) 50vw, 25vw"
              : "(max-width: 700px) 100vw, 33vw"
          }
        />
        <span className="image-tag">{article.category}</span>
      </Link>
      <div className="news-card-body">
        <span className="meta">
          {formatDate(article.date)}{" "}
          {article.isSample && <span>· Sample update</span>}
        </span>
        <h3>
          <Link href={`/news/${article.slug}`}>{article.title}</Link>
        </h3>
        <NewsSource article={article} />
        <p>{article.excerpt}</p>
        <Link href={`/news/${article.slug}`} className="text-link">
          Read story
          <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
export function NewsGrid({
  articles,
  compact = false,
}: {
  articles: NewsArticle[];
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? "news-grid-compact" : "grid gap-6 md:grid-cols-3"}
    >
      {articles.map((article) => (
        <NewsCard key={article.slug} article={article} compact={compact} />
      ))}
    </div>
  );
}
