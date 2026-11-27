import { RichText } from "@/components/shared/RichText";
import { NewsSource } from "@/components/news/NewsSource";
export const dynamicParams = true;
import Link from "next/link";
import { PhotoGallery } from "@/components/shared/PhotoGallery";
import { notFound } from "next/navigation";
import { getNews, getArticle } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { SectionHeader } from "@/components/shared/ui";
import { NewsGrid } from "@/components/news/NewsCard";
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
        <h1>{a.title}</h1>
        <NewsSource article={a} />
        <p className="meta mt-5">
          {formatDate(a.date)} · Municipal information portal
        </p>
        <PhotoGallery
          title={a.title}
          coverImage={a.image}
          images={a.galleryImages}
          preload
        />
        <div className="article-body">
          <RichText document={a.richBody} legacy={a.content} />
        </div>
      </article>
      <div className="mt-16">
        <SectionHeader eyebrow="KEEP EXPLORING" title="Related updates" />
        <NewsGrid articles={related} />
      </div>
    </section>
  );
}
