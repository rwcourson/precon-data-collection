"use client";

import { useState } from "react";
import { deviceAuthClient } from "@/lib/auth-client-device";
import { mcpScopeLabel } from "@/lib/authorization/mcp-scopes";

type DeviceRequest = {
  client_id?: string;
  scope?: string;
  resource?: string | string[];
};

function normalizeCode(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

export function DeviceAuthorizationClient({
  initialCode = "",
}: {
  initialCode?: string;
}) {
  const [userCode, setUserCode] = useState(initialCode);
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
  const [request, setRequest] = useState<DeviceRequest | null>(null);
  const [pending, setPending] = useState<"verify" | "approve" | "deny" | null>(
    null
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    const formatted = normalizeCode(userCode);
    if (!formatted) {
      setError("Enter the code shown by your AI tool.");
      return;
    }
    setPending("verify");
    setError(null);
    setMessage(null);
    const result = await deviceAuthClient.device({
      query: { user_code: formatted },
    });
    if (result.error || !result.data) {
      setError(
        result.error?.error_description ||
          "That device code is invalid or expired."
      );
      setPending(null);
      return;
    }
    setVerifiedCode(formatted);
    setRequest(result.data as DeviceRequest);
    setPending(null);
  };

  const decide = async (accept: boolean) => {
    if (!verifiedCode) return;
    setPending(accept ? "approve" : "deny");
    setError(null);
    const result = accept
      ? await deviceAuthClient.device.approve({ userCode: verifiedCode })
      : await deviceAuthClient.device.deny({ userCode: verifiedCode });
    if (result.error) {
      setError(
        result.error.error_description ||
          `Could not ${accept ? "approve" : "deny"} this connection.`
      );
      setPending(null);
      return;
    }
    setRequest(null);
    setMessage(
      accept
        ? "Connection approved. Return to your AI tool; it will finish automatically."
        : "Connection denied. You can close this page."
    );
    setPending(null);
  };

  const scopes = (request?.scope ?? "").split(/\s+/).filter(Boolean);
  const resources = Array.isArray(request?.resource)
    ? request.resource
    : request?.resource
      ? [request.resource]
      : [];

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#00143c] px-4 py-10 text-white">
      <div className="relative z-10 w-full max-w-[480px] rounded-lg border border-white/12 bg-[#002070] px-6 py-8 shadow-[0_16px_40px_rgb(0_0_0_/_0.45)] sm:px-8">
        <h1 className="font-heading text-xl font-semibold">
          Connect an AI tool
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#d6e6ff]">
          Only approve a code currently displayed by a tool you control. Never
          approve a code sent in an unexpected message.
        </p>

        {!request && !message ? (
          <div className="mt-6 space-y-3">
            <label htmlFor="device-code" className="block text-sm font-medium">
              Device code
            </label>
            <input
              id="device-code"
              value={userCode}
              onChange={(event) => setUserCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void verify();
              }}
              autoComplete="one-time-code"
              className="h-12 w-full rounded-md border border-white/20 bg-[#0c2048] px-3 font-mono text-xl tracking-[0.2em] outline-none focus-visible:ring-2 focus-visible:ring-white"
              placeholder="ABCD-1234"
            />
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void verify()}
              className="h-12 w-full rounded-md bg-white px-3 font-medium text-[#0c2048] disabled:opacity-50"
            >
              {pending === "verify" ? "Checking…" : "Continue"}
            </button>
          </div>
        ) : null}

        {request ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-white/12 bg-[#0c2048] p-3 text-sm">
              <p>
                Client:{" "}
                <span className="font-mono">
                  {request.client_id ?? "AI tool"}
                </span>
              </p>
              {resources.map((resource) => (
                <p key={resource} className="mt-2 break-all text-[#d6e6ff]">
                  Resource: {resource}
                </p>
              ))}
              {scopes.length ? (
                <ul className="mt-3 space-y-1 text-[#d6e6ff]">
                  {scopes.map((scope) => (
                    <li key={scope}>{mcpScopeLabel(scope)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void decide(false)}
                className="h-12 flex-1 rounded-md border border-white/20 disabled:opacity-50"
              >
                {pending === "deny" ? "Denying…" : "Deny"}
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void decide(true)}
                className="h-12 flex-1 rounded-md bg-white font-medium text-[#0c2048] disabled:opacity-50"
              >
                {pending === "approve" ? "Approving…" : "Approve"}
              </button>
            </div>
          </div>
        ) : null}

        {message ? (
          <p role="status" className="mt-6 rounded-md bg-[#0c2048] p-3 text-sm">
            {message}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-[#e99ba1]/40 bg-[#9c343c]/20 p-3 text-sm text-[#f8d0d3]"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
