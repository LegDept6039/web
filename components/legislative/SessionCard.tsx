import { CalendarDays, FileText } from "lucide-react";
import type { Session } from "@/types";
import { formatDate } from "@/lib/utils";
export function SessionCard({ session }: { session: Session }) {
  return (
    <article className="session-card">
      <div className="session-body">
        <span className="eyebrow">{session.type}</span>
        <h2>{session.name || `${session.number} ${session.type}`}</h2>
        <p className="meta">Sangguniang Bayan</p>
        <p className="session-card-date">
          <CalendarDays size={15} aria-hidden="true" />
          <time dateTime={session.date}>{formatDate(session.date)}</time>
        </p>
        {session.description && (
          <p className="body-copy session-description">{session.description}</p>
        )}
        {session.agenda.length > 0 && (
          <details className="agenda">
            <summary>
              <FileText size={16} aria-hidden="true" />
              View agenda
            </summary>
            <ol>
              {session.agenda.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </article>
  );
}
