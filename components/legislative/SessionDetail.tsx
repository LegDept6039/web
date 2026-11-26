import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ExternalLink, FileText } from "lucide-react";
import type { LegislativeDocument, MunicipalDocument, Session } from "@/types";
import { PageHero } from "@/components/shared/ui";
import { formatDate } from "@/lib/utils";
import styles from "./SessionDetail.module.css";

function PassedDocuments({
  documents,
  kind,
}: {
  documents: LegislativeDocument[];
  kind: "ordinances" | "resolutions";
}) {
  const title = kind === "ordinances" ? "Ordinances" : "Resolutions";
  return (
    <section
      className={styles.recordSection}
      aria-labelledby={`${kind}-heading`}
      id={kind}
    >
      <div className={styles.sectionHeading}>
        <h2 id={`${kind}-heading`}>{title}</h2>
        <span>{documents.length} passed</span>
      </div>
      {documents.length ? (
        <table className={styles.records}>
          <caption className="sr-only">
            {title} passed during this session
          </caption>
          <thead>
            <tr>
              <th scope="col">No.</th>
              <th scope="col">Title</th>
              <th scope="col">
                <span className="sr-only">View record</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td data-label="No.">{document.number}</td>
                <td>
                  <p className={styles.documentTitle}>{document.title}</p>
                  <p className={styles.authorship}>
                    {document.approvalMode === "mass_motion"
                      ? "Approval: Mass motion"
                      : `Author: ${document.author}${document.coAuthor ? ` · Co-author: ${document.coAuthor}` : ""}`}
                  </p>
                </td>
                <td>
                  <Link
                    className="text-link"
                    href={`/legislative/${kind}/${encodeURIComponent(document.id)}`}
                  >
                    View record
                    <ArrowUpRight size={14} aria-hidden="true" />
                    <span className="sr-only">
                      : {kind === "ordinances" ? "Ordinance" : "Resolution"}{" "}
                      {document.number}
                    </span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.empty}>
          No passed {kind} have been published for this session yet.
        </p>
      )}
    </section>
  );
}

function SessionFiles({
  documents,
  type,
}: {
  documents: MunicipalDocument[];
  type: "agenda" | "minutes";
}) {
  return (
    <ul className={styles.files}>
      {documents.map((document) => (
        <li key={document.id} className={styles.file}>
          <div className={styles.fileHeading}>
            <FileText size={18} aria-hidden="true" />
            <h3>{document.title}</h3>
          </div>
          <time className={styles.fileDate} dateTime={document.date}>
            {formatDate(document.date)}
          </time>
          {document.description && (
            <p className={styles.preview}>{document.description}</p>
          )}
          <div className={styles.fileLinks}>
            <Link
              className="text-link"
              href={`/legislative/documents/${encodeURIComponent(document.id)}`}
            >
              View {type}
              <ArrowUpRight size={14} aria-hidden="true" />
              <span className="sr-only">: {document.title}</span>
            </Link>
            {document.fileUrl && (
              <a
                className="text-link"
                href={document.fileUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open PDF
                <ExternalLink size={14} aria-hidden="true" />
                <span className="sr-only">
                  : {document.title} (opens in a new tab)
                </span>
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SessionDetail({
  session,
  records,
}: {
  session: Session;
  records: {
    ordinances: LegislativeDocument[];
    resolutions: LegislativeDocument[];
    agendas: MunicipalDocument[];
    minutes: MunicipalDocument[];
  };
}) {
  const name = session.name || `${session.number} ${session.type}`;
  const sessionsHref = `/legislative/sessions?term=${encodeURIComponent(session.termId || "unassigned")}`;
  return (
    <div className={styles.page}>
      <PageHero
        title={name}
        eyebrow={session.type}
        description={formatDate(session.date)}
      />
      <div className={`container ${styles.content}`}>
        <Link className="text-link" href={sessionsHref}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to sessions
        </Link>
        {session.description && (
          <p className={styles.description}>{session.description}</p>
        )}
        <nav className={styles.jumpLinks} aria-label="Session records">
          <a href="#ordinances">
            Ordinances <span>{records.ordinances.length}</span>
          </a>
          <a href="#resolutions">
            Resolutions <span>{records.resolutions.length}</span>
          </a>
          <a href="#agenda">Session agenda</a>
          <a href="#minutes">Session minutes</a>
        </nav>
        <PassedDocuments kind="ordinances" documents={records.ordinances} />
        <PassedDocuments kind="resolutions" documents={records.resolutions} />
        <div className={styles.fileSections}>
          <section
            className={styles.recordSection}
            aria-labelledby="agenda-heading"
            id="agenda"
          >
            <div className={styles.sectionHeading}>
              <h2 id="agenda-heading">Session agenda</h2>
            </div>
            {session.agenda.length > 0 && (
              <div className={styles.agendaItems}>
                <h3>Agenda items</h3>
                <ol>
                  {session.agenda.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ol>
              </div>
            )}
            {records.agendas.length > 0 && (
              <SessionFiles type="agenda" documents={records.agendas} />
            )}
            {!session.agenda.length && !records.agendas.length && (
              <p className={styles.empty}>
                No agenda has been published for this session yet.
              </p>
            )}
          </section>
          <section
            className={styles.recordSection}
            aria-labelledby="minutes-heading"
            id="minutes"
          >
            <div className={styles.sectionHeading}>
              <h2 id="minutes-heading">Session minutes</h2>
            </div>
            {records.minutes.length ? (
              <SessionFiles type="minutes" documents={records.minutes} />
            ) : (
              <p className={styles.empty}>
                No minutes have been published for this session yet.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
