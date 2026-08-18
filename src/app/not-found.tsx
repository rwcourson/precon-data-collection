import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-6 text-center">
        <p className="font-mono text-xs text-muted-foreground">404</p>
        <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <Button nativeButton={false} render={<Link href="/" />}>
          Back to home
        </Button>
      </div>
    </div>
  );
}
