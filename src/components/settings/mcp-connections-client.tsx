"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { revokeOwnMcpConsent } from "@/actions/mcp";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MCP_SCOPE_LABELS } from "@/lib/authorization/mcp-scopes";

export type OwnConnection = {
  consentId: string;
  clientName: string;
  clientIcon: string | null;
  scopes: string[];
  lastUsedAtLabel: string;
};

export function McpConnectionsClient({
  connections,
  ssoMode,
  serverUrl,
}: {
  connections: OwnConnection[];
  ssoMode: boolean;
  serverUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not update connections</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Connected AI tools</CardTitle>
          <CardDescription>
            Revoke a client to drop its access tokens immediately. MCP is Entra
            SSO only — demo mode cannot mint OAuth grants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!ssoMode ? (
            <p className="text-sm text-muted-foreground">
              Sign in with Microsoft on a deployed environment to connect
              Claude, Cursor, or another MCP client.
            </p>
          ) : connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No AI tools connected yet. Use the server URL below in your
              client&apos;s MCP connector settings.
            </p>
          ) : (
            <ul className="space-y-3">
              {connections.map((row) => (
                <li
                  key={row.consentId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{row.clientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.scopes
                        .map((scope) => MCP_SCOPE_LABELS[scope] ?? scope)
                        .join(" · ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last used {row.lastUsedAtLabel}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        try {
                          await revokeOwnMcpConsent(row.consentId);
                          toast.success("Disconnected");
                          router.refresh();
                        } catch (err) {
                          const message =
                            err instanceof Error
                              ? err.message
                              : "Revoke failed";
                          setError(message);
                          toast.error(message);
                        }
                      });
                    }}
                  >
                    {pending ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : null}
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Connect an AI tool</CardTitle>
          <CardDescription>
            Paste this MCP server URL into Claude Desktop, Claude Code, Cursor,
            or MCP Inspector. You will sign in with Microsoft and approve scopes
            on the next screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Server URL:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {serverUrl}
            </code>
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Open the client&apos;s MCP / connectors settings.</li>
            <li>Add a custom connector using the server URL above.</li>
            <li>
              Complete Microsoft sign-in and review the consent page (humanized
              scopes).
            </li>
            <li>
              If a tool is missing, an admin may need to raise your MCP ceiling
              under Admin → MCP Access.
            </li>
          </ol>
          <p className="text-muted-foreground">
            Full client-by-client steps are in <code>docs/mcp.md</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
