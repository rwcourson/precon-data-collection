"use client";

import { useState } from "react";
import {
  filterConsentScopes,
  mcpScopeLabel,
} from "@/lib/authorization/mcp-scopes";

export async function submitOauthConsent(input: {
  accept: boolean;
  oauthQuery: string;
  scope?: string;
}): Promise<{ redirect_uri: string }> {
  const response = await fetch("/api/auth/oauth2/consent", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accept: input.accept,
      oauth_query: input.oauthQuery,
      ...(input.scope ? { scope: input.scope } : {}),
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    redirect_uri?: string;
    error?: string;
    message?: string;
  } | null;
  if (!response.ok || !body?.redirect_uri) {
    throw new Error(
      body?.message ||
        body?.error ||
        `Consent ${input.accept ? "approval" : "denial"} failed.`
    );
  }
  return { redirect_uri: body.redirect_uri };
}

export function ConsentClient({
  clientId,
  scopes,
  oauthQuery,
}: {
  clientId: string | null;
  scopes: string[];
  oauthQuery: string;
}) {
  const [pending, setPending] = useState<"accept" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (accept: boolean) => {
    setPending(accept ? "accept" : "deny");
    setError(null);
    try {
      const result = await submitOauthConsent({
        accept,
        oauthQuery,
        scope: accept ? filterConsentScopes(scopes).join(" ") : undefined,
      });
      window.location.assign(result.redirect_uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Consent failed.");
      setPending(null);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#00143c] px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(56_136_255_/_0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgb(0_40_240_/_0.16),transparent_50%)]"
      />
      <div className="relative z-10 w-full max-w-[480px] rounded-lg border border-white/12 bg-[#002070] px-6 py-8 text-white shadow-[0_16px_40px_rgb(0_0_0_/_0.45)] sm:px-8">
        <div className="space-y-2 text-center">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance text-white">
            Connect an AI tool
          </h1>
          <p className="text-pretty text-[15px] leading-relaxed text-[#d6e6ff]">
            {clientId
              ? `${clientId} wants access to Precon on your behalf.`
              : "An AI tool wants access to Precon on your behalf."}{" "}
            Approve only the data this tool needs.
          </p>
        </div>

        <ul className="mt-6 space-y-2" aria-label="Requested permissions">
          {scopes.length === 0 ? (
            <li className="rounded-md border border-white/12 bg-[#0c2048] px-3 py-2 text-sm text-[#d6e6ff]">
              No specific permissions were listed.
            </li>
          ) : (
            scopes.map((scope) => (
              <li
                key={scope}
                className="rounded-md border border-white/12 bg-[#0c2048] px-3 py-2 text-sm leading-relaxed text-[#d6e6ff]"
              >
                <span className="font-medium text-white">
                  {mcpScopeLabel(scope)}
                </span>
                <span className="mt-0.5 block font-mono text-[11px] text-[#93a9d6]">
                  {scope}
                </span>
              </li>
            ))
          )}
        </ul>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-[#e99ba1]/40 bg-[#9c343c]/20 px-3 py-2 text-sm leading-relaxed text-[#f8d0d3]"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void decide(false)}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-md border border-white/20 bg-transparent px-3 text-[15px] font-medium text-white outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
          >
            {pending === "deny" ? "Denying…" : "Deny"}
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void decide(true)}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-md bg-white px-3 text-[15px] font-medium text-[#0c2048] outline-none transition-colors hover:bg-[#f4f7fb] focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
          >
            {pending === "accept" ? "Approving…" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
