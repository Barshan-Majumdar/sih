function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-strong/70 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="app-page" aria-busy="true">
      <div className="app-page-header">
        <div className="w-full max-w-2xl">
          <SkeletonBlock className="mb-3 h-3 w-32" />
          <SkeletonBlock className="h-8 w-80 max-w-full" />
          <SkeletonBlock className="mt-3 h-4 w-full max-w-xl" />
        </div>
        <SkeletonBlock className="hidden h-10 w-28 shrink-0 sm:block" />
      </div>

      <div className="mt-6 space-y-4">
        <div className="app-toolbar">
          <div className="w-full max-w-sm">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="mt-2 h-3 w-64 max-w-full" />
          </div>
          <SkeletonBlock className="h-10 w-36" />
        </div>

        <div className="app-table-wrap">
          <div className="grid grid-cols-[48px_2fr_1fr_1fr_1fr_1fr] gap-3 border-b border-hairline bg-surface-soft px-4 py-3">
            {[0, 1, 2, 3, 4, 5].map((cell) => (
              <SkeletonBlock key={cell} className="h-3" />
            ))}
          </div>
          <div className="divide-y divide-hairline-soft">
            {[0, 1, 2, 3, 4, 5, 6].map((row) => (
              <div key={row} className="grid grid-cols-[48px_2fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-4">
                {[0, 1, 2, 3, 4, 5].map((cell) => (
                  <SkeletonBlock key={cell} className="h-4" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
