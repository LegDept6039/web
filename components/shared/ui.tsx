import Link from "next/link";
import { ArrowRight, ChevronRight, Info, SearchX } from "lucide-react";
export function SectionHeader({
  eyebrow,
  title,
  description,
  href,
  linkText = "View all",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  href?: string;
  linkText?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {href && (
        <Link href={href} className="text-link">
          {linkText}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function PageHero({
  title,
  description,
  eyebrow = "MUNICIPALITY OF PINAMUNGAJAN",
}: {
  title: string;
  description: string;
  eyebrow?: string;
}) {
  return (
    <div className="page-hero">
      <div className="container">
        <div className="breadcrumb">
          <Link href="/">Home</Link>
          <ChevronRight size={12} />
          <span>{title}</span>
        </div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
export function PreviewNote({ children }: { children?: React.ReactNode }) {
  return (
    <div className="preview-note">
      <Info size={17} />
      <p>
        {children ??
          "Development preview — records, schedules, and content shown here are samples, not official municipal publications."}
      </p>
    </div>
  );
}
export function EmptyState() {
  return (
    <div className="empty-state">
      <SearchX size={32} />
      <h3>No matching results</h3>
      <p>Try a different keyword or clear your filters.</p>
    </div>
  );
}
export function LoadingSkeleton() {
  return (
    <div
      className="container section"
      aria-label="Loading content"
      role="status"
    >
      <div className="skeleton h-12 w-2/3" />
      <div className="grid md:grid-cols-3 gap-6 mt-8">
        {[1, 2, 3].map((n) => (
          <div key={n} className="skeleton h-64" />
        ))}
      </div>
    </div>
  );
}
