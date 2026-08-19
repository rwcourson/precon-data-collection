import { createMcpHandler } from "@modelcontextprotocol/server";
import { mcpClientIdFromClaims, recordMcpToolAudit } from "@/lib/mcp/audit";
import type { McpAccessTokenClaims } from "@/lib/mcp/claims";
import { resolveMcpPrincipal } from "@/lib/mcp/resolve-principal";
import { createPreconMcpServer, MCP_WRITE_TOOL_NAMES } from "@/lib/mcp/tools";

/** JSON-RPC envelope cap. Tool arguments are also bounded by zod schemas. */
export const MAX_MCP_BODY_BYTES = 256 * 1024;

function jsonRpcError(
  status: number,
  message: string,
  code: string,
  id: unknown = null,
  extraHeaders?: HeadersInit
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: {
        code: status === 401 ? -32001 : -32003,
        message,
        data: { code },
      },
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...extraHeaders,
      },
    }
  );
}

function jsonRpcId(request: Request): Promise<unknown> {
  return request
    .clone()
    .json()
    .then((body) =>
      body && typeof body === "object" && "id" in body
        ? (body as { id: unknown }).id
        : null
    )
    .catch(() => null);
}

async function denyWriteWithoutGrant(
  request: Request,
  effectiveScopes: readonly string[]
): Promise<Response | null> {
  if (effectiveScopes.includes("write:pursuits")) return null;
  const body = await request
    .clone()
    .json()
    .then((value) => value as Record<string, unknown>)
    .catch(() => null);
  if (body?.method !== "tools/call") return null;
  const params = body.params as { name?: unknown } | undefined;
  const name = params?.name;
  if (typeof name !== "string" || !MCP_WRITE_TOOL_NAMES.includes(name)) {
    return null;
  }
  return jsonRpcError(
    403,
    "Missing MCP grant: write:pursuits. Ask a Precon admin to enable write access, then reconnect and consent to that scope.",
    "scope_denied",
    body.id ?? null
  );
}

async function toolsCallName(request: Request): Promise<string | null> {
  const body = await request
    .clone()
    .json()
    .then((value) => value as Record<string, unknown>)
    .catch(() => null);
  if (body?.method !== "tools/call") return null;
  const params = body.params as { name?: unknown } | undefined;
  return typeof params?.name === "string" ? params.name : null;
}

/**
 * Authenticated MCP dispatch. Tests inject verified JWT claims here instead of
 * driving Better Auth token verification.
 */
export async function handleMcpWithClaims(
  request: Request,
  claims: McpAccessTokenClaims
): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_MCP_BODY_BYTES) {
    return jsonRpcError(
      413,
      "Request body too large.",
      "payload_too_large",
      null
    );
  }
  const tool = await toolsCallName(request);
  const clientId = mcpClientIdFromClaims(claims);
  const resolved = await resolveMcpPrincipal(claims);
  if (!resolved.ok) {
    const id = await jsonRpcId(request);
    const headers =
      resolved.status === 401
        ? {
            "WWW-Authenticate":
              'Bearer error="invalid_token", error_description="Access token expired."',
          }
        : undefined;
    return jsonRpcError(
      resolved.status,
      resolved.message,
      resolved.code,
      id,
      headers
    );
  }

  const writeDenied = await denyWriteWithoutGrant(
    request,
    resolved.effectiveScopes
  );
  if (writeDenied) {
    if (tool) {
      await recordMcpToolAudit({
        userId: resolved.principal.user.id,
        clientId,
        tool,
        decision: "denied",
        reason: "scope_denied",
      });
    }
    return writeDenied;
  }

  if (tool) {
    await recordMcpToolAudit({
      userId: resolved.principal.user.id,
      clientId,
      tool,
      decision: "allowed",
    });
  }

  const handler = createMcpHandler(
    () => createPreconMcpServer(resolved.principal, resolved.effectiveScopes),
    // 2025 clients POST JSON-RPC without the 2026 `_meta` envelope. Stateless
    // fallback is the SDK default and keeps Claude/Cursor working; GET/DELETE
    // stay 405.
    { legacy: "stateless" }
  );
  return handler.fetch(request);
}
