import { headers } from "next/headers";
import { PageHeader } from "@/components/page-header";
import { McpConnectionsClient } from "@/components/settings/mcp-connections-client";
import { authMode } from "@/lib/auth";
import { auth } from "@/lib/auth-server";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { fmtDateTime } from "@/lib/format";
import { listMcpConnections } from "@/lib/mcp/connections";
import { getRuntimeConfig } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  await getWebPrincipal();
  const config = getRuntimeConfig();
  const serverUrl = `${config.appOrigin.replace(/\/$/, "")}/api/mcp`;
  const sso = authMode() === "sso";
  let connections: Awaited<ReturnType<typeof listMcpConnections>> = [];
  if (sso) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id) {
      connections = await listMcpConnections({ authUserId: session.user.id });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="AI connections"
        description="See which MCP clients can act as you, revoke access, and copy the server URL for a new tool."
      />
      <McpConnectionsClient
        ssoMode={sso}
        serverUrl={serverUrl}
        connections={connections.map((row) => ({
          consentId: row.consentId,
          clientName: row.clientName,
          clientIcon: row.clientIcon,
          scopes: row.scopes,
          lastUsedAtLabel: row.lastUsedAt
            ? fmtDateTime(row.lastUsedAt)
            : "never",
        }))}
      />
    </div>
  );
}
