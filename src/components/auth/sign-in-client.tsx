"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

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
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#00143c] px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(56_136_255_/_0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgb(0_40_240_/_0.16),transparent_50%)]"
      />

      <div className="relative z-10 w-full max-w-[420px] rounded-lg border border-white/12 bg-[#002070] px-8 py-8 text-white shadow-[0_16px_40px_rgb(0_0_0_/_0.45)]">
        <div className="space-y-5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-lg bg-[#0c2048] ring-1 ring-white/15">
            <span
              aria-hidden
              className="size-8 bg-white"
              style={{
                mask: 'url("/bg-ampersand.png") center / contain no-repeat',
                WebkitMask: 'url("/bg-ampersand.png") center / contain no-repeat',
              }}
            />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance text-white">
              B&amp;G Precon
            </h1>
            <p className="text-pretty text-[15px] leading-relaxed text-[#d6e6ff]">
              Sign in with your Brasfield &amp; Gorrie Microsoft account to open
              pursuits and data.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-md border border-[#e99ba1]/40 bg-[#9c343c]/20 px-3 py-2 text-sm leading-relaxed text-[#f8d0d3]"
            >
              {error}
            </p>
          )}
          <button
            type="button"
            className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-md bg-white px-3 text-[15px] font-medium text-[#0c2048] shadow-sm outline-none transition-colors hover:bg-[#f4f7fb] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#002070] disabled:pointer-events-none disabled:opacity-50"
            disabled={pending}
            onClick={signIn}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MicrosoftGlyph className="size-4 shrink-0" />
            )}
            {pending ? "Redirecting to Microsoft…" : "Sign in with Microsoft"}
          </button>
          <p className="text-pretty text-center text-[13px] leading-relaxed text-[#93a9d6]">
            No app passwords — identity is Microsoft Entra ID. Contact Precon
            admin if your groups are not mapped.
          </p>
        </div>
      </div>
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
