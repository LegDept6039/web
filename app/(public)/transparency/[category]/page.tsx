import { readContentConfig } from "@/lib/content/config";
export const dynamicParams = true;
import { notFound } from "next/navigation";
import Link from "next/link";
import { FolderOpen, ArrowLeft } from "lucide-react";
import { getDocumentCategories, getDocuments } from "@/lib/api/transparency";
import { PageHero } from "@/components/shared/ui";
export async function generateStaticParams() {
  if (readContentConfig(process.env).source === "supabase") return [];
  return (await getDocumentCategories())
    .filter((c) => !c.href)
    .map((c) => ({ category: c.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const c = (await getDocumentCategories()).find((c) => c.id === category);
  return { title: c?.name ?? "Category not found" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const c = (await getDocumentCategories()).find(
    (c) => c.id === category && !c.href,
  );
  if (!c) notFound();
  const documents = await getDocuments(category);
  return (
    <>
      <PageHero
        title={c.name}
        description={c.description}
        eyebrow="TRANSPARENCY PORTAL"
      />
      <section className="container section">
        {documents.length ? (
          <div className="document-list">
            {documents.map((doc) => (
              <article className="document-card" key={doc.id}>
                <div className="document-content">
                  <span className="eyebrow">
                    {doc.date}
                    {doc.isSample ? " ? Sample document" : ""}
                  </span>
                  <h2>{doc.title}</h2>
                  <p className="body-copy">{doc.description}</p>
                </div>
                <a
                  href={doc.fileUrl}
                  className="text-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  View document
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <FolderOpen size={36} />
            <h2 className="mt-5 text-2xl">Documents awaiting publication</h2>
            <p className="mt-4">
              Verified documents in this category will be added by the
              municipality.
            </p>
            <p className="mt-2">
              There are no official files available in this development preview.
            </p>
          </div>
        )}
        <Link href="/transparency" className="text-link mt-8">
          <ArrowLeft size={16} />
          All transparency categories
        </Link>
      </section>
    </>
  );
}
