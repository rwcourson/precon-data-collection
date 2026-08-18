export default function Loading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="space-y-2">
        <div className="h-6 w-56 rounded bg-muted" />
        <div className="h-4 w-full max-w-2xl rounded bg-muted" />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="h-96 rounded-lg border border-border bg-muted" />
        <div className="h-96 rounded-lg border border-border bg-muted" />
      </div>
    </div>
  );
}
