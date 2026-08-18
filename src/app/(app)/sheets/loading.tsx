export default function Loading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="space-y-2">
        <div className="h-6 w-32 rounded bg-muted" />
        <div className="h-4 w-full max-w-2xl rounded bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg border border-border bg-muted" />
        ))}
      </div>
    </div>
  );
}
