export default function Loading() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="space-y-2">
        <div className="h-6 w-44 rounded bg-muted" />
        <div className="h-4 w-full max-w-2xl rounded bg-muted" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="h-8 w-72 rounded bg-muted" />
        <div className="h-8 w-96 max-w-full rounded bg-muted" />
      </div>
      <div className="space-y-2 rounded-md border border-border bg-card p-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-8 rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
