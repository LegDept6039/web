import type { NewsArticle } from "@/types";

/** Use only the public projection's source; a missing slug must stay unlinked. */
export function getNewsSource(
  article: NewsArticle,
): NonNullable<NewsArticle["source"]> {
  if (article.source?.name.trim()) return article.source;
  return {
    name:
      article.contentScope === "legislative"
        ? "Legislative Access"
        : "Municipal information portal",
  };
}

export function newsOfficeId(article: NewsArticle) {
  if (article.barangayId) return `barangay:${article.barangayId}`;
  return article.officeId || `source:${getNewsSource(article).name}`;
}

export function newsOfficeOptions(articles: NewsArticle[]) {
  const offices = new Map<string, { id: string; name: string }>();
  for (const article of articles) {
    const id = newsOfficeId(article);
    offices.set(id, { id, name: getNewsSource(article).name });
  }
  return [...offices.values()].sort((a, b) => a.name.localeCompare(b.name));
}
