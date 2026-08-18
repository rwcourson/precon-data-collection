export default function Loading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="space-y-2">
        <div className="h-6 w-40 rounded bg-muted" />
        <div className="h-4 w-full max-w-2xl rounded bg-muted" />
      </div>
      <div className="space-y-2 rounded-md border border-border bg-card p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 rounded bg-muted" />
        ))}
      </div>
      <div className="h-40 rounded-lg border border-border bg-muted" />
    </div>
  );
}
