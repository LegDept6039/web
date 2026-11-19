import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import type { LegislativeDocument } from "@/types";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { RecordBody } from "@/components/legislative/RecordBody";
import { formatDate } from "@/lib/utils";
export function DocumentDetail({
  document: d,
  kind,
}: {
  document: LegislativeDocument;
  kind: "ordinances" | "resolutions";
}) {
  const label = kind === "ordinances" ? "Ordinance" : "Resolution";
  const number = d.number.trim();
  const numberWithYear = number.endsWith(`-${d.year}`)
    ? number
    : `${number}-${d.year}`;
  return (
    <div className="legislative-record-page">
      <PageHero
        title={`${label} No. ${numberWithYear}`}
        description={d.title}
        eyebrow={
          d.isSample ? "SAMPLE LEGISLATIVE RECORD" : "LEGISLATIVE RECORD"
        }
      />
      <div className="container legislative-record-content">
        <article className="record-detail">
          {d.isSample && (
            <PreviewNote>
              This is a fictional sample record. It is not an enacted municipal
              measure or an official legal document.
            </PreviewNote>
          )}
          <dl aria-label="Record details">
            <div>
              <dt>Date approved{d.isSample ? " (sample)" : ""}</dt>
              <dd>{formatDate(d.dateApproved)}</dd>
            </div>
            <div>
              <dt>Status{d.isSample ? " (sample)" : ""}</dt>
              <dd>{d.status}</dd>
            </div>
            <div>
              <dt>Author</dt>
              <dd>{d.author}</dd>
            </div>
            {d.coAuthor && (
              <div>
                <dt>Co-author</dt>
                <dd>{d.coAuthor}</dd>
              </div>
            )}
            {d.committeeName && (
              <div>
                <dt>Category</dt>
                <dd>{d.committeeName}</dd>
              </div>
            )}
            {d.sessionName && (
              <div>
                <dt>Session</dt>
                <dd>{d.sessionName}</dd>
              </div>
            )}
          </dl>
          <section className="record-body" aria-labelledby="record-body-title">
            <h2 id="record-body-title">Body</h2>
            <RecordBody key={d.id} text={d.summary} />
          </section>
          <section
            className="record-attachment"
            aria-labelledby="record-attachment-title"
          >
            <FileText size={24} aria-hidden="true" />
            <div>
              <h2 id="record-attachment-title">Document Attachment</h2>
              {d.isSample && (
                <p>
                  The linked file is a shared demonstration attachment, not the
                  official text of this record.
                </p>
              )}
              {d.pdfUrl ? (
                <a
                  className="text-link"
                  href={d.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {d.isSample
                    ? "View sample PDF document"
                    : "View PDF document"}
                </a>
              ) : (
                <p>
                  The official PDF has not been supplied. A verified document
                  link will appear here when published by the municipality.
                </p>
              )}
            </div>
          </section>
          <Link className="text-link" href={`/legislative/${kind}`}>
            <ArrowLeft size={16} />
            Back to {kind}
          </Link>
        </article>
      </div>
    </div>
  );
}
