import { describe, expect, it } from "vitest";
import { GET as getAuthorizationMetadata } from "@/app/.well-known/oauth-authorization-server/[[...path]]/route";
import { GET as getProtectedResourceMetadata } from "@/app/.well-known/oauth-protected-resource/[[...path]]/route";
import { POST as postAuth } from "@/app/api/auth/[...all]/route";
import { mcpResourceIdentifier } from "@/lib/auth-server";

describe("MCP OAuth discovery documents", () => {
  it("advertises the resource-bound authorization server and scopes", async () => {
    const response = await getProtectedResourceMetadata(
      new Request(
        "http://127.0.0.1:3001/.well-known/oauth-protected-resource/api/mcp"
      )
    );
    expect(response.status).toBe(200);
    const metadata = (await response.json()) as {
      resource: string;
      authorization_servers: string[];
      scopes_supported: string[];
    };
    expect(metadata.resource).toMatch(/\/api\/mcp$/);
    expect(metadata.authorization_servers[0]).toMatch(/\/api\/auth$/);
    expect(metadata.scopes_supported).toContain("profile:read");
  });

  it("advertises CIMD, DCR, PKCE, refresh, and device authorization", async () => {
    const response = await getAuthorizationMetadata(
      new Request(
        "http://127.0.0.1:3001/.well-known/oauth-authorization-server/api/auth"
      )
    );
    expect(response.status).toBe(200);
    const metadata = (await response.json()) as Record<string, unknown>;
    expect(metadata.client_id_metadata_document_supported).toBe(true);
    expect(metadata.registration_endpoint).toMatch(/\/oauth2\/register$/);
    expect(metadata.device_authorization_endpoint).toMatch(
      /\/api\/auth\/device\/code$/
    );
    expect(metadata.code_challenge_methods_supported).toContain("S256");
    expect(metadata.grant_types_supported).toContain("refresh_token");
    expect(metadata.grant_types_supported).toContain(
      "urn:ietf:params:oauth:grant-type:device_code"
    );
  });

  it("registers a public device client and issues a resource-bound device code", async () => {
    const registration = await postAuth(
      new Request("http://127.0.0.1:3001/api/auth/oauth2/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Vitest MCP device client",
          application_type: "native",
          token_endpoint_auth_method: "none",
          redirect_uris: ["http://127.0.0.1/oauth/callback"],
          grant_types: [
            "authorization_code",
            "urn:ietf:params:oauth:grant-type:device_code",
            "refresh_token",
          ],
          response_types: ["code"],
          scope: "offline_access profile:read",
        }),
      })
    );
    const registrationBody = (await registration.json()) as {
      client_id: string;
      error?: string;
      error_description?: string;
    };
    expect(registration.status, JSON.stringify(registrationBody)).toBe(201);
    const client = registrationBody;
    expect(client.client_id).toBeTruthy();

    const deviceCode = await postAuth(
      new Request("http://127.0.0.1:3001/api/auth/device/code", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: client.client_id,
          scope: "offline_access profile:read",
          resource: mcpResourceIdentifier(),
        }),
      })
    );
    expect(deviceCode.status).toBe(200);
    const body = (await deviceCode.json()) as Record<string, unknown>;
    expect(body.device_code).toBeTruthy();
    expect(body.user_code).toBeTruthy();
    expect(body.verification_uri).toMatch(/\/device$/);
  });

  it("registers Cursor's native callback through the HTTPS trampoline", async () => {
    const registration = await postAuth(
      new Request("https://precon.example/api/auth/oauth2/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Cursor",
          token_endpoint_auth_method: "none",
          redirect_uris: ["cursor://anysphere.cursor-mcp/oauth/callback"],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          scope: "profile:read",
        }),
      })
    );
    const body = (await registration.json()) as {
      redirect_uris?: string[];
      error_description?: string;
    };
    expect(registration.status, body.error_description).toBe(201);
    expect(body.redirect_uris).toEqual([
      "https://precon.example/api/auth/native-callback?redirect_uri=cursor%3A%2F%2Fanysphere.cursor-mcp%2Foauth%2Fcallback",
    ]);
  });

  it("registers Cursor's localhost callback even when the client claims web", async () => {
    const registration = await postAuth(
      new Request("https://precon.example/api/auth/oauth2/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Cursor localhost",
          application_type: "web",
          token_endpoint_auth_method: "none",
          redirect_uris: ["http://localhost:8787/callback"],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          scope: "profile:read",
        }),
      })
    );
    const body = (await registration.json()) as {
      application_type?: string;
      error_description?: string;
    };
    expect(registration.status, body.error_description).toBe(201);
    expect(body.application_type).toBe("native");
  });
});
