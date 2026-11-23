import type { Official } from "@/types";
import { legislativeRoles } from "@/lib/officials/roles";
import { OfficialPhoto } from "./OfficialPhoto";
export function OfficialGrid({
  officials,
  directory = false,
}: {
  officials: Official[];
  directory?: boolean;
}) {
  const Heading = directory ? "h2" : "h3";
  return (
    <div
      className={
        directory ? "official-grid council-directory" : "official-grid"
      }
    >
      {officials.map((o, i) => (
        <article className="official-card" key={o.id}>
          <div className={`official-portrait portrait-${i}`}>
            <OfficialPhoto
              src={o.photoUrl}
              name={o.name}
              sizes={
                directory
                  ? "(max-width: 640px) 200px, 240px"
                  : "(max-width: 540px) 40vw, (max-width: 800px) 240px, (max-width: 1100px) 20vw, 240px"
              }
            />
          </div>
          <div className="official-info">
            <div className="official-identity">
              <Heading>{o.name}</Heading>
              <p className="official-role">
                {o.legislativeRole ? legislativeRoles[o.legislativeRole] : o.role}
              </p>
            </div>
            {o.description && (
              <p className="official-description">{o.description}</p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
