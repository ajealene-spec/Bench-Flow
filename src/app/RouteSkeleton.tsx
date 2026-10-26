/** Placeholder shown while a lazily loaded route or panel is fetched. Shape matches a page header and two cards. */
export function RouteSkeleton({ label = 'Loading page' }: { label?: string }) {
  return (
    <main aria-busy="true" aria-label={label} className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-2">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-8 w-2/3" />
        <div className="skeleton h-4 w-1/2" />
      </div>
      <div className="card flex flex-col gap-3 p-6">
        <div className="skeleton h-5 w-1/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
      </div>
      <div className="card flex flex-col gap-3 p-6">
        <div className="skeleton h-5 w-1/4" />
        <div className="skeleton h-12 w-full" />
      </div>
      <span className="sr-only">{label}</span>
    </main>
  );
}
