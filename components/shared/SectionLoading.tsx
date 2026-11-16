import { SkeletonCard, SkeletonLines } from "./PageSkeleton";
export function SectionLoading({
  cards = 0,
  rows = 1,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <div
      className="container section section-loading"
      role="status"
      aria-busy="true"
      aria-label="Loading content"
    >
      <span className="sr-only">Loading content...</span>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} aria-hidden="true" className="loading-row">
          <div className="skeleton skeleton-heading" />
          {cards ? (
            <div className={`loading-cards loading-cards-${cards}`}>
              {Array.from({ length: cards }, (_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <div className="skeleton-panel">
              <SkeletonLines />
              <SkeletonLines />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
