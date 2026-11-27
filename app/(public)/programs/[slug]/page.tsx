import { RichText } from "@/components/shared/RichText";
import Link from "next/link";
import { PhotoGallery } from "@/components/shared/PhotoGallery";
import { notFound } from "next/navigation";
import { getProgram } from "@/lib/api";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const program = await getProgram((await params).slug);
  return {
    title: program?.name || "Program not found",
    description: program?.description,
  };
}
export default async function ProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const program = await getProgram((await params).slug);
  if (!program) notFound();
  const department = program.source;
  return (
    <section className="container section">
      <article className="article">
        <div className="breadcrumb">
          <Link href="/programs">Programs & projects</Link>
        </div>
        <span className="eyebrow">{program.category}</span>
        <h1>{program.name}</h1>
        {department && (
          <p>
            Responsible office:{" "}
            {department.slug ? (
              <Link href={`/departments/${department.slug}`}>
                {department.name}
              </Link>
            ) : (
              department.name
            )}
          </p>
        )}
        <p className="meta">{program.status}</p>
        <PhotoGallery
          title={program.name}
          coverImage={program.image}
          images={program.galleryImages}
        />
        <div className="article-body">
          <RichText document={program.richBody} legacy={program.description} />
        </div>
      </article>
    </section>
  );
}
