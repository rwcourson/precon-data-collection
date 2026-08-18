import { createHmac } from "node:crypto";

function secret(): string {
  const configured =
    process.env.BETTER_AUTH_SECRET?.trim() || process.env.AI_GATEWAY_API_KEY?.trim();
  if (configured) return configured;
  // Must match copilot-bridge.ts: the well-known dev fallback is only
  // acceptable on a developer machine, never on a hosted deployment.
  if (process.env.VERCEL || process.env.APP_ENV === "production") {
    throw new Error(
      "Copilot tool signing requires BETTER_AUTH_SECRET or AI_GATEWAY_API_KEY on hosted deployments.",
    );
  }
  return "precon-demo-copilot";
}

function origin(): string {
  const fromEnv = process.env.APP_ORIGIN?.trim() || process.env.EVE_APP_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL?.trim()) return `https://${process.env.VERCEL_URL.trim()}`;
  return "http://127.0.0.1:3000";
}

export async function callAppTool(
  tool: string,
  input: Record<string, unknown>,
  auth: {
    principalId?: string | null;
    workspaceRegion?: string | null;
  },
): Promise<unknown> {
  const principalId = auth.principalId;
  if (!principalId) {
    throw new Error("Copilot tools require an authenticated app user.");
  }
  const hmac = createHmac("sha256", secret()).update(`${principalId}:${tool}`).digest("hex");
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-eve-principal-id": principalId,
    "x-eve-hmac": hmac,
  };
  if (auth.workspaceRegion != null) {
    headers["x-eve-workspace"] = auth.workspaceRegion;
  }
  const response = await fetch(`${origin()}/api/v1/copilot/tools`, {
    method: "POST",
    headers,
    body: JSON.stringify({ tool, input }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `App tool ${tool} failed (${response.status})`);
  }
  return response.json();
}

export function sessionAuth(ctx: {
  session: {
    auth: {
      current?: {
        principalId?: string;
        attributes?: Record<string, unknown>;
      } | null;
    };
  };
}) {
  const current = ctx.session.auth.current;
  const region = current?.attributes?.region;
  return {
    principalId: current?.principalId ?? null,
    workspaceRegion: typeof region === "string" || region === null ? region : undefined,
  };
}
