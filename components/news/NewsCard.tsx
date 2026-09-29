import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { NewsArticle } from "@/types";
import { formatDate } from "@/lib/utils";
export function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <article className="news-card">
      <Link href={`/news/${article.slug}`} className="news-image">
        <Image
          src={article.image}
          alt="Illustration accompanying a sample municipal update"
          fill
          sizes="(max-width: 700px) 100vw, 33vw"
        />
        <span className="image-tag">{article.category}</span>
      </Link>
      <div className="news-card-body">
        <span className="meta">
          {formatDate(article.date)} <span>· Sample update</span>
        </span>
        <h3>
          <Link href={`/news/${article.slug}`}>{article.title}</Link>
        </h3>
        <p>{article.excerpt}</p>
        <Link href={`/news/${article.slug}`} className="text-link">
          Read story
          <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
export function NewsGrid({ articles }: { articles: NewsArticle[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {articles.map((article) => (
        <NewsCard key={article.slug} article={article} />
      ))}
    </div>
  );
}
