import type { Official } from "@/types";
import { legislativeRoles } from "@/lib/officials/roles";
import { OfficialPhoto } from "./OfficialPhoto";
export function OfficialGrid({ officials }: { officials: Official[] }) {
  return (
    <div className="official-grid">
      {officials.map((o, i) => (
        <article className="official-card" key={o.id}>
          <div className={`official-portrait portrait-${i}`}>
            <OfficialPhoto src={o.photoUrl} name={o.name} />
          </div>
          <div className="official-info">
            <h3>{o.name}</h3>
            <p>{o.description}</p>
            <p className="eyebrow">
              {o.legislativeRole ? legislativeRoles[o.legislativeRole] : o.role}
            </p>
            {o.isSample && (
              <p className="meta">Name and portrait to be confirmed</p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
