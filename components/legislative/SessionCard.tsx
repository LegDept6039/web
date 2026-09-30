import Image from "next/image";
import { CalendarDays, FileText } from "lucide-react";
import type { Session } from "@/types";
import { formatDate } from "@/lib/utils";
export function SessionCard({ session }: { session: Session }) {
  return (
    <article className="session-card">
      <div className="session-image">
        <Image
          src={session.image}
          alt={`${session.number} ${session.type}`}
          fill
          sizes="(max-width: 700px) 100vw, 50vw"
        />
      </div>
      <div className="p-6">
        <span className="eyebrow">{session.type}</span>
        <h2>
          {session.number} {session.type}
        </h2>
        <p className="meta">
          Sangguniang Bayan{session.isSample ? " \u00b7 Sample record" : ""}
        </p>
        <p className="flex items-center gap-2 mt-4 text-sm">
          <CalendarDays size={16} />
          {formatDate(session.date)}
        </p>
        <p className="body-copy mt-3">{session.description}</p>
        <details className="agenda">
          <summary>
            <FileText size={16} />
            {session.isSample ? "View sample agenda" : "View agenda"}
          </summary>
          <ol>
            {session.agenda.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </details>
      </div>
    </article>
  );
}
