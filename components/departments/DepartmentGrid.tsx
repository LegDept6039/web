import { OfficialPhoto } from "@/components/officials/OfficialPhoto";
import Link from "next/link";
import type { Department, Program } from "@/types";
import { DepartmentImage } from "./DepartmentImage";
export function DepartmentGrid({
  departments,
  portraits = false,
}: {
  departments: Department[];
  portraits?: boolean;
}) {
  if (!departments.length)
    return <p>No departments have been published yet.</p>;
  return (
    <div
      className={
        portraits ? "content-grid department-directory-grid" : "content-grid"
      }
    >
      {departments.map((d) => (
        <article className="info-card department-card" key={d.id}>
          <div className="department-photo">
            {portraits ? (
              <OfficialPhoto
                src={d.headPhoto}
                name={d.headName || `${d.name} department head`}
                sizes="(max-width: 640px) 85vw, (max-width: 1000px) 40vw, 28vw"
              />
            ) : (
              <DepartmentImage src={d.imageUrl} name={d.name} />
            )}
          </div>
          {d.acronym && <span className="eyebrow">{d.acronym}</span>}
          <h2>
            <Link href={`/departments/${d.slug || d.id}`}>{d.name}</Link>
          </h2>
          <p>{d.description}</p>
          <Link className="text-link" href={`/departments/${d.slug || d.id}`}>
            View department
          </Link>
        </article>
      ))}
    </div>
  );
}
export function ProgramGrid({ programs }: { programs: Program[] }) {
  return (
    <div className="content-grid">
      {programs.map((p) => (
        <article className="info-card" key={p.id}>
          <span className="eyebrow">{p.category}</span>
          <h3>
            <Link href={`/programs/${p.slug || p.id}`}>{p.name}</Link>
          </h3>
          <p>{p.description}</p>
          <small>{p.status}</small>
          <Link className="text-link" href={`/programs/${p.slug || p.id}`}>
            View program
          </Link>
        </article>
      ))}
    </div>
  );
}
