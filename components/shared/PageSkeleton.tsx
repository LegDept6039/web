export function SkeletonLines() {
  return (
    <div className="skeleton-lines">
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line skeleton-line-short" />
    </div>
  );
}
export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-card-image" />
      <div className="skeleton-card-body">
        <div className="skeleton skeleton-eyebrow" />
        <div className="skeleton skeleton-title" />
        <SkeletonLines />
        <div className="skeleton skeleton-link" />
      </div>
    </div>
  );
}
export function PublicPageSkeleton() {
  return (
    <section
      className="page-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading page"
    >
      <span className="sr-only">Loading page content...</span>
      <div aria-hidden="true">
        <div className="skeleton-hero">
          <div className="container">
            <div className="skeleton skeleton-eyebrow" />
            <div className="skeleton skeleton-heading" />
            <SkeletonLines />
          </div>
        </div>
        <div className="container section">
          <div className="skeleton skeleton-toolbar" />
          <div className="loading-cards loading-cards-3">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
export function AdminSkeleton({
  shell = false,
  variant = "dashboard",
}: {
  shell?: boolean;
  variant?: "dashboard" | "table" | "form";
}) {
  const content = (
    <div className="admin-skeleton-content">
      <div className="skeleton skeleton-eyebrow" />
      <div className="skeleton skeleton-heading" />
      <SkeletonLines />
      {variant === "dashboard" && (
        <div className="admin-skeleton-cards">
          {[0, 1, 2].map((i) => (
            <div className="skeleton-panel" key={i}>
              <div className="skeleton skeleton-eyebrow" />
              <div className="skeleton skeleton-title" />
              <SkeletonLines />
            </div>
          ))}
        </div>
      )}
      {variant === "form" ? (
        <div className="skeleton-panel admin-skeleton-form">
          <div className="admin-skeleton-form-grid">
            <div className="skeleton skeleton-form-image" />
            <div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-form-field">
                  <div className="skeleton skeleton-eyebrow" />
                  <div className="skeleton skeleton-toolbar" />
                </div>
              ))}
            </div>
          </div>
          <div className="skeleton skeleton-eyebrow" />
          <div className="skeleton skeleton-form-body" />
          <div className="skeleton skeleton-form-button" />
        </div>
      ) : (
        <div className="skeleton-panel">
          <div className="skeleton skeleton-toolbar" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div className="skeleton-table-row" key={i}>
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-link" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading administration"
      className={shell ? "admin-skeleton-shell" : "admin-skeleton"}
    >
      <span className="sr-only">Loading administration...</span>
      {shell && (
        <div className="admin-skeleton-sidebar" aria-hidden="true">
          <div className="skeleton skeleton-title" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton skeleton-nav" />
          ))}
        </div>
      )}
      <div aria-hidden="true" className="admin-skeleton-main">
        {shell && (
          <div className="admin-skeleton-top">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-avatar" />
          </div>
        )}
        {content}
      </div>
    </div>
  );
}

export function AdminTableSkeleton() {
  return <AdminSkeleton variant="table" />;
}
export function AdminFormSkeleton() {
  return <AdminSkeleton variant="form" />;
}
