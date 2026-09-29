import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";
export function TransparencyBanner() {
  return (
    <>
      <section className="container transparency-section">
        <div className="transparency-banner">
          <ShieldCheck size={39} strokeWidth={1.4} />
          <div>
            <span className="eyebrow">YOUR RIGHT TO KNOW</span>
            <h2>Good governance is open governance.</h2>
            <p>
              Access public records, financial disclosures, and municipal
              documents.
            </p>
          </div>
          <Link href="/transparency" className="button button-outline">
            Visit transparency portal
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>
      <div className="container preview-home">
        Development preview: sample content and placeholder official profiles
        are shown for review.
      </div>
    </>
  );
}
