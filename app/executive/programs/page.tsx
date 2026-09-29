import type { Metadata } from "next";
import { getPrograms } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
export const metadata: Metadata = { title: "Programs & projects" };
export default async function Page() {
  return (
    <>
      <PageHero
        title="Programs & projects"
        description="Community priorities, municipal initiatives, and the work toward a better tomorrow."
      />
      <section className="container section">
        <PreviewNote>
          These are illustrative programs. Verified project scopes, budgets,
          schedules, and progress reports will be added before launch.
        </PreviewNote>
        <div className="content-grid">
          {(await getPrograms()).map((p) => (
            <article className="info-card" key={p.id}>
              <span className="eyebrow">{p.category}</span>
              <h2>{p.name}</h2>
              <p>{p.description}</p>
              <small>{p.status}</small>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
