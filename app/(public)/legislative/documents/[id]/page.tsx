import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollection } from "@/lib/content/repository";
import { PageHero } from "@/components/shared/ui";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = (
    await getCollection("documents", { id, content_scope: "legislative" })
  )[0];
  if (!d) notFound();
  const session = d.sessionId
    ? (
        await getCollection("sessions", {
          id: d.sessionId,
          content_scope: "legislative",
        })
      )[0]
    : undefined;
  return (
    <>
      <PageHero
        eyebrow="LEGISLATIVE DOCUMENT"
        title={d.title}
        description={d.date}
      />
      <article className="container section">
        <div className="article">
          {session && <p>Session: {session.name || session.number}</p>}
          <p className="whitespace-pre-wrap">{d.description}</p>
          {d.fileUrl && (
            <p>
              <a href={d.fileUrl} target="_blank" rel="noreferrer">
                View attachment
              </a>
            </p>
          )}
          <Link href="/legislative/documents">Back to documents</Link>
        </div>
      </article>
    </>
  );
}
