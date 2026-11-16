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
                  ? "(max-width: 640px) 90vw, (max-width: 1100px) 45vw, 25vw"
                  : undefined
              }
            />
          </div>
          <div className="official-info">
            <Heading>{o.name}</Heading>
            {!directory && (
              <p className="official-description">{o.description}</p>
            )}
            <p className="eyebrow">
              {o.legislativeRole ? legislativeRoles[o.legislativeRole] : o.role}
            </p>
            {directory && o.description && (
              <p className="official-description">{o.description}</p>
            )}
            {o.isSample && (
              <p className="meta">Name and portrait to be confirmed</p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
