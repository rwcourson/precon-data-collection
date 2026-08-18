export default function Loading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="space-y-2">
        <div className="h-6 w-40 rounded bg-muted" />
        <div className="h-4 w-full max-w-2xl rounded bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-lg border border-border bg-muted"
          />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-64 rounded-lg border border-border bg-muted" />
        <div className="h-64 rounded-lg border border-border bg-muted" />
      </div>
    </div>
  );
}
