export function SectionLoading({
  cards = 0,
  rows = 1,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <div className="container section section-loading" role="status">
      <span className="loading-dot" aria-hidden="true" /> Loading content?
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} aria-hidden="true" className="loading-row">
          <div
            className="skeleton"
            style={{ height: 32, width: "55%", marginBottom: 24 }}
          />
          {cards ? (
            <div className={`loading-cards loading-cards-${cards}`}>
              {Array.from({ length: cards }, (_, i) => (
                <div key={i} className="skeleton" style={{ height: 320 }} />
              ))}
            </div>
          ) : (
            <div className="skeleton" style={{ height: 180 }} />
          )}
        </div>
      ))}
    </div>
  );
}
