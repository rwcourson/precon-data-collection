"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { authMode } from "@/lib/auth";
import { auth } from "@/lib/auth-server";
import {
  type McpAdminConfig,
  parseMcpAdminConfig,
} from "@/lib/authorization/mcp-policy";
import type { GrantableMcpScope } from "@/lib/authorization/mcp-scopes";
import {
  loadMcpAdminConfig,
  saveMcpAdminConfig,
  upsertMcpUserOverride,
} from "@/lib/authorization/mcp-settings";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { listMcpConnections, revokeMcpConsent } from "@/lib/mcp/connections";
import { assertPrincipalAdmin } from "@/services/mutation-policy";

function revalidateMcp() {
  revalidatePath("/admin");
  revalidatePath("/settings/connections");
}

export async function setMcpKillSwitch(enabled: boolean) {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "mcp", "manage", "MCP access");
  const current = await loadMcpAdminConfig();
  await saveMcpAdminConfig({ ...current, enabled });
  revalidateMcp();
}

export async function setMcpRoleDefaults(
  roleDefaults: McpAdminConfig["roleDefaults"]
) {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "mcp", "manage", "MCP access");
  const current = await loadMcpAdminConfig();
  await saveMcpAdminConfig(
    parseMcpAdminConfig({
      enabled: current.enabled,
      roleDefaults,
    })
  );
  revalidateMcp();
}

export async function setMcpUserOverride(input: {
  userId: number;
  inherit: boolean;
  enabled: boolean | null;
  scopeCeiling: GrantableMcpScope[] | null;
}) {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "mcp", "manage", "MCP access");
  await upsertMcpUserOverride({
    userId: input.userId,
    enabled: input.inherit ? null : input.enabled,
    scopeCeiling: input.inherit ? null : (input.scopeCeiling ?? []),
    updatedById: principal.user.id,
  });
  revalidateMcp();
}

export async function adminRevokeMcpConsent(consentId: string) {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "mcp", "manage", "MCP access");
  const ok = await revokeMcpConsent(consentId);
  if (!ok) throw new Error("Connection not found");
  revalidateMcp();
}

export async function revokeOwnMcpConsent(consentId: string) {
  await getWebPrincipal();
  if (authMode() !== "sso") {
    throw new Error("MCP connections are available in SSO mode only.");
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("Not signed in.");
  const mine = await listMcpConnections({ authUserId: session.user.id });
  if (!mine.some((row) => row.consentId === consentId)) {
    throw new Error("Connection not found");
  }
  const ok = await revokeMcpConsent(consentId);
  if (!ok) throw new Error("Connection not found");
  revalidatePath("/settings/connections");
}
