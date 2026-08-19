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
  searchParams: Promise<{
    client_id?: string;
    scope?: string;
    code?: string;
    claims?: string;
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.client_id) query.set("client_id", params.client_id);
  if (params.scope) query.set("scope", params.scope);
  if (params.code) query.set("code", params.code);
  if (params.claims) query.set("claims", params.claims);
  const oauthQuery = query.toString();

  if (authMode() === "sso") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      const next = `/consent${oauthQuery ? `?${oauthQuery}` : ""}`;
      redirect(`/sign-in?next=${encodeURIComponent(next)}`);
    }
  }

  return (
    <ConsentClient
      clientId={params.client_id ?? null}
      scopes={filterConsentScopes(parseConsentScopes(params.scope))}
      oauthQuery={oauthQuery}
    />
  );
}
