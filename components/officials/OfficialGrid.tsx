import Link from "next/link";
import { UserRound, ArrowUpRight } from "lucide-react";
import type { Official } from "@/types";
export function OfficialGrid({ officials }: { officials: Official[] }) {
  return (
    <div className="official-grid">
      {officials.map((o, i) => (
        <article className="official-card" key={o.id}>
          <div className={`official-portrait portrait-${i}`}>
            <UserRound size={90} strokeWidth={0.8} />
            <span>OFFICIAL PROFILE</span>
          </div>
          <div className="official-info">
            <p className="eyebrow">{o.role}</p>
            <h3>{o.name}</h3>
            <p className="meta">Name and portrait to be confirmed</p>
            <Link
              href={
                o.branch === "executive"
                  ? o.id === "mayor"
                    ? "/executive/mayor"
                    : "/executive/departments"
                  : o.id === "committees"
                    ? "/legislative/committees"
                    : "/legislative/members"
              }
              aria-label={`Learn more about ${o.name}`}
            >
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
