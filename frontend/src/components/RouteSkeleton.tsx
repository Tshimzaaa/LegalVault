import './RouteSkeleton.css'

// Suspense fallback for lazy-loaded pages inside the staff dashboard shell — shown
// for the brief moment a page's chunk is downloading after clicking a sidebar nav item.
// Mirrors the shape of a typical dashboard page (topbar + card grid) so the swap-in feels
// like a continuation rather than a blank flash.
function RouteSkeleton() {
  return (
    <>
      <span role="status" className="visually-hidden">
        Loading…
      </span>
      <div className="dash-main" aria-hidden="true">
        <div className="skeleton-topbar">
          <span className="skeleton-block skeleton-title" />
          <span className="skeleton-block skeleton-action" />
        </div>
        <div className="skeleton-grid">
          <span className="skeleton-block skeleton-card" />
          <span className="skeleton-block skeleton-card" />
          <span className="skeleton-block skeleton-card" />
        </div>
      </div>
    </>
  )
}

export default RouteSkeleton
