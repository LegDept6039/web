export const dynamicParams = false;
import { notFound } from "next/navigation";
import Link from "next/link";
import { FolderOpen, ArrowLeft } from "lucide-react";
import { getDocumentCategories } from "@/lib/api/transparency";
import { PageHero } from "@/components/shared/ui";
export async function generateStaticParams() {
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
  return (
    <>
      <PageHero
        title={c.name}
        description={c.description}
        eyebrow="TRANSPARENCY PORTAL"
      />
      <section className="container section">
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
        <Link href="/transparency" className="text-link mt-8">
          <ArrowLeft size={16} />
          All transparency categories
        </Link>
      </section>
    </>
  );
}
