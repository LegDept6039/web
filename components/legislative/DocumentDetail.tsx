import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import type { LegislativeDocument } from "@/types";
import { PageHero, PreviewNote } from "@/components/shared/ui";
import { formatDate } from "@/lib/utils";
export function DocumentDetail({
  document: d,
  kind,
}: {
  document: LegislativeDocument;
  kind: "ordinances" | "resolutions";
}) {
  const label = kind === "ordinances" ? "Ordinance" : "Resolution";
  return (
    <>
      <PageHero
        title={`${label} No. ${d.number}`}
        description={d.title}
        eyebrow="SAMPLE LEGISLATIVE RECORD"
      />
      <section className="container section">
        <div className="article record-detail">
          <PreviewNote>
            This is a fictional sample record. It is not an enacted municipal
            measure or an official legal document.
          </PreviewNote>
          <h2>{d.title}</h2>
          <dl>
            <div>
              <dt>Date approved (sample)</dt>
              <dd>{formatDate(d.dateApproved)}</dd>
            </div>
            <div>
              <dt>Status (sample)</dt>
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
          </dl>
          <h3>Record summary</h3>
          <p className="body-copy mt-4">{d.summary}</p>
          <div className="info-card my-8">
            <FileText className="mb-4" />
            <h3>Document attachment</h3>
            <p className="mb-4">
              The linked file is a shared demonstration attachment, not the
              official text of this record.
            </p>
            {d.pdfUrl ? (
              <a
                className="text-link"
                href={d.pdfUrl}
                target="_blank"
                rel="noreferrer"
              >
                View sample PDF document
              </a>
            ) : (
              <p>
                The official PDF has not been supplied. A verified document link
                will appear here when published by the municipality.
              </p>
            )}
          </div>
          <Link className="text-link" href={`/legislative/${kind}`}>
            <ArrowLeft size={16} />
            Back to {kind}
          </Link>
        </div>
      </section>
    </>
  );
}
