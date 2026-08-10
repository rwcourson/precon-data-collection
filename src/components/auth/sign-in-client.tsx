"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SignInClient({
  initialNext,
  initialError,
}: {
  initialNext?: string;
  initialError?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const signIn = async () => {
    setPending(true);
    setError(null);
    try {
      const callbackURL =
        initialNext && initialNext.startsWith("/") && !initialNext.startsWith("//")
          ? initialNext
          : "/";
      const result = await authClient.signIn.social({
        provider: "microsoft",
        callbackURL,
      });
      if (result?.error) {
        setError(result.error.message || "Sign-in failed");
        setPending(false);
      }
      // On success the browser navigates to Microsoft.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setPending(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Soft brand wash — no app chrome */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_55%),radial-gradient(ellipse_at_bottom_right,color-mix(in_oklch,var(--info)_10%,transparent),transparent_50%)]"
      />

      <Card className="relative z-10 w-full max-w-[420px] border-border/80 shadow-lg">
        <CardHeader className="space-y-3 pb-2 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <span
              aria-hidden
              className="size-8 bg-current"
              style={{
                mask: 'url("/bg-ampersand.png") center / contain no-repeat',
                WebkitMask: 'url("/bg-ampersand.png") center / contain no-repeat',
              }}
            />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold tracking-tight">
              B&amp;G Precon
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Sign in with your Brasfield &amp; Gorrie Microsoft account to open
              pursuits and data.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive-soft px-3 py-2 text-xs leading-relaxed text-destructive-foreground"
            >
              {error}
            </p>
          )}
          <Button
            className="h-11 w-full gap-2.5 text-sm font-medium"
            size="lg"
            disabled={pending}
            onClick={signIn}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MicrosoftGlyph className="size-4 shrink-0" />
            )}
            {pending ? "Redirecting to Microsoft…" : "Sign in with Microsoft"}
          </Button>
          <p className="text-center text-2xs leading-relaxed text-muted-foreground">
            No app passwords — identity is Microsoft Entra ID. Contact Precon
            admin if your groups are not mapped.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MicrosoftGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
