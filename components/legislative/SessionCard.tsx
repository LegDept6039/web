import Link from "next/link";
import { CalendarDays, ArrowUpRight } from "lucide-react";
import type { Session } from "@/types";
import { formatDate } from "@/lib/utils";
import styles from "./SessionDetail.module.css";
export function SessionCard({ session }: { session: Session }) {
  const href = `/legislative/sessions/${encodeURIComponent(session.id)}`;
  return (
    <article className="session-card">
      <div className="session-body">
        <span className="eyebrow">{session.type}</span>
        <h2>
          <Link href={href} className={styles.cardTitle}>
            {session.name || `${session.number} ${session.type}`}
          </Link>
        </h2>
        <p className="meta">Sangguniang Bayan</p>
        <p className="session-card-date">
          <CalendarDays size={15} aria-hidden="true" />
          <time dateTime={session.date}>{formatDate(session.date)}</time>
        </p>
        {session.description && (
          <p className={`body-copy session-description ${styles.cardPreview}`}>
            {session.description}
          </p>
        )}
        <Link href={href} className={`text-link ${styles.cardAction}`}>
          View session
          <ArrowUpRight size={14} aria-hidden="true" />
          <span className="sr-only">
            : {session.name || `${session.number} ${session.type}`}
          </span>
        </Link>
      </div>
    </article>
  );
}
