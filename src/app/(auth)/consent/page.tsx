import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ConsentClient } from "@/components/auth/consent-client";
import { authMode } from "@/lib/auth";
import { auth } from "@/lib/auth-server";
import {
  filterConsentScopes,
  parseConsentScopes,
} from "@/lib/authorization/mcp-scopes";

export const dynamic = "force-dynamic";

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Forward the ENTIRE authorize redirect query, including Better Auth's
  // signed-query params (sig, ba_param, ba_iat). Dropping any signed param
  // makes POST /oauth2/consent fail verification with invalid_signature.
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) query.append(key, v);
    } else if (typeof value === "string") {
      query.append(key, value);
    }
  }
  const oauthQuery = query.toString();
  const clientId =
    typeof params.client_id === "string" ? params.client_id : null;
  const scopeParam = typeof params.scope === "string" ? params.scope : null;

  if (authMode() === "sso") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      const next = `/consent${oauthQuery ? `?${oauthQuery}` : ""}`;
      redirect(`/sign-in?next=${encodeURIComponent(next)}`);
    }
  }

  return (
    <ConsentClient
      clientId={clientId}
      scopes={filterConsentScopes(parseConsentScopes(scopeParam ?? undefined))}
      oauthQuery={oauthQuery}
    />
  );
}
