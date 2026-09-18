function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-strong/70 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="app-page" aria-busy="true">
      <div className="app-page-header">
        <div className="w-full max-w-2xl">
          <SkeletonBlock className="mb-3 h-3 w-24" />
          <SkeletonBlock className="h-8 w-72 max-w-full" />
          <SkeletonBlock className="mt-3 h-4 w-full max-w-xl" />
        </div>
        <SkeletonBlock className="hidden h-10 w-32 shrink-0 sm:block" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-lg border border-hairline bg-canvas p-5 shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="mt-5 h-8 w-20" />
            <SkeletonBlock className="mt-4 h-2 w-full" />
          </div>
        ))}
      </div>

      <div className="app-table-wrap mt-6">
        <div className="border-b border-hairline bg-surface-soft px-4 py-3">
          <SkeletonBlock className="h-3 w-48" />
        </div>
        <div className="divide-y divide-hairline-soft">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-4 py-4">
              <SkeletonBlock className="h-4" />
              <SkeletonBlock className="h-4" />
              <SkeletonBlock className="h-4" />
              <SkeletonBlock className="h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
