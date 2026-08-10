"use client";

import { use, useState } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SignInClient({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = use(searchParams);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(params.error ?? null);

  const signIn = async () => {
    setPending(true);
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "microsoft",
        callbackURL: params.next && params.next.startsWith("/") ? params.next : "/",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span
              aria-hidden
              className="size-7 bg-current"
              style={{
                mask: 'url("/bg-ampersand.png") center / contain no-repeat',
                WebkitMask: 'url("/bg-ampersand.png") center / contain no-repeat',
              }}
            />
          </div>
          <CardTitle className="text-xl tracking-tight">B&amp;G Precon</CardTitle>
          <CardDescription>
            Sign in with your Brasfield &amp; Gorrie Microsoft account to access
            pursuits and data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive-soft px-3 py-2 text-xs text-destructive-foreground">
              {error}
            </p>
          )}
          <Button className="w-full gap-2" size="lg" disabled={pending} onClick={signIn}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MicrosoftGlyph className="size-4" />
            )}
            Sign in with Microsoft
          </Button>
          <p className="text-center text-2xs text-muted-foreground">
            Zero passwords in this app — identity comes from Microsoft Entra ID.
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
