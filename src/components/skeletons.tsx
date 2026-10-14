export function GridSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 h-7 w-48 animate-pulse rounded bg-slate-100" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
