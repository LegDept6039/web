export const dynamicParams = false;
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getNews, getArticle } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { PreviewNote, SectionHeader } from "@/components/shared/ui";
import { NewsGrid } from "@/components/news/NewsCard";
export async function generateStaticParams() {
  return (await getNews()).map((n) => ({ slug: n.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await getArticle(slug);
  return { title: a?.title ?? "Article not found", description: a?.excerpt };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) notFound();
  const related = (await getNews()).filter((n) => n.slug !== slug).slice(0, 3);
  return (
    <section className="container section">
      <article className="article">
        <div className="breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/news">News & updates</Link>
        </div>
        <span className="eyebrow">{a.category}</span>
        <h1>{a.title}</h1>
        <p className="meta mt-5">
          {formatDate(a.date)} · Municipal information portal · Sample article
        </p>
        <div className="article-image">
          <Image
            src={a.image}
            alt="Illustrative placeholder for a sample municipal article"
            fill
            sizes="(max-width: 800px) 100vw, 790px"
            priority
          />
        </div>
        <PreviewNote />
        <div className="article-body">
          {a.content.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </article>
      <div className="mt-16">
        <SectionHeader eyebrow="KEEP EXPLORING" title="Related updates" />
        <NewsGrid articles={related} />
      </div>
    </section>
  );
}
