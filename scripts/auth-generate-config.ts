/**
 * Generate-only Better Auth config (no Drizzle adapter). Used by `auth generate`
 * so plugin tables can be emitted before they exist in src/db/auth-schema.ts.
 */
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { oauthDeviceAuthorization } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { MCP_ADVERTISED_SCOPES } from "../src/lib/authorization/mcp-scopes";

export const auth = betterAuth({
  secret: "generate-only-secret-not-for-runtime!!",
  baseURL: "http://127.0.0.1:3000",
  plugins: [
    jwt({
      disableSettingJwtHeader: true,
    }),
    mcp({
      loginPage: "/sign-in",
      consentPage: "/consent",
      resource: "http://127.0.0.1:3000/api/mcp",
      scopes: [...MCP_ADVERTISED_SCOPES],
    }),
    cimd({
      fetchClientMetadataResource,
      metadataProfile: "mcp-2026-07-28",
    }),
    oauthDeviceAuthorization({
      verificationUri: "/device",
    }),
  ],
});
