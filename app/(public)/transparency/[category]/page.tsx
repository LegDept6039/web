import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { FolderOpen, ArrowLeft } from "lucide-react";
import { getDocumentCategories, getDocuments } from "@/lib/api/transparency";
import { PageHero } from "@/components/shared/ui";
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
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ q?: string; year?: string }>;
}) {
  const { category } = await params;
  const c = (await getDocumentCategories()).find(
    (c) => c.id === category && !c.href,
  );
  if (!c) notFound();
  if (c.contentScope === "transparency")
    redirect(`/transparency?module=${encodeURIComponent(c.id)}`);
  const all = await getDocuments(category);
  const { q = "", year = "" } = await searchParams;
  const documents = all.filter(
    (d) =>
      (!year || d.date.startsWith(`${year}-`)) &&
      `${d.title} ${d.description}`.toLowerCase().includes(q.toLowerCase()),
  );
  const years = [...new Set(all.map((d) => d.date.slice(0, 4)))]
    .sort()
    .reverse();
  return (
    <>
      <PageHero
        title={c.name}
        description={c.description}
        eyebrow="TRANSPARENCY PORTAL"
      />
      <section className="container section">
        <form className="transparency-filters" method="get">
          <label>
            Search documents
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Title or description"
            />
          </label>
          <label>
            Year
            <select name="year" defaultValue={year}>
              <option value="">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-blue" type="submit">
            Search
          </button>
          <Link href={`/transparency/${c.id}`}>Clear filters</Link>
        </form>
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
            <h2 className="mt-5 text-2xl">
              {all.length
                ? "No matching documents"
                : "Documents awaiting publication"}
            </h2>
            <p className="mt-4">
              Verified documents in this category will be added by the
              municipality.
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
