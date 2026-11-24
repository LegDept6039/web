import { OfficialPhoto } from "@/components/officials/OfficialPhoto";
import { DepartmentImage } from "./DepartmentImage";
import Link from "next/link";
import type { Department, Program } from "@/types";
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
            {d.parentDepartmentId ? (
              <DepartmentImage src={d.imageUrl} name={d.name} />
            ) : (
              <OfficialPhoto
                src={d.headPhoto}
                name={d.headName || `${d.name} department head`}
                sizes="(max-width: 639px) 85vw, (max-width: 1023px) 40vw, 22vw"
              />
            )}
          </div>
          {d.acronym && <span className="eyebrow">{d.acronym}</span>}
          <h2>
            <Link href={`/departments/${d.slug || d.id}`}>{d.name}</Link>
          </h2>
          <p>{d.description}</p>
          <Link className="text-link" href={`/departments/${d.slug || d.id}`}>
            {d.parentDepartmentId ? "View branch" : "View department"}
          </Link>
        </article>
      ))}
    </div>
  );
}
export function DepartmentBranchGrid({ branches }: { branches: Department[] }) {
  return (
    <div className="content-grid department-branch-grid">
      {branches.map((branch) => (
        <article className="info-card" key={branch.id}>
          {branch.acronym && <span className="eyebrow">{branch.acronym}</span>}
          <h3>
            <Link href={`/departments/${branch.slug || branch.id}`}>
              {branch.name}
            </Link>
          </h3>
          {branch.description && <p>{branch.description}</p>}
          <Link
            className="text-link"
            href={`/departments/${branch.slug || branch.id}`}
          >
            View branch
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
