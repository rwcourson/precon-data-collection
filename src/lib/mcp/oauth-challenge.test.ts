import { describe, expect, it } from "vitest";
import { GET, HEAD } from "@/app/api/mcp/route";
import {
  mcpOAuthChallengeResponse,
  mcpProtectedResourceMetadataUrl,
} from "@/lib/mcp/oauth-challenge";

describe("mcp OAuth GET challenge", () => {
  it("advertises path-aware protected-resource metadata", () => {
    expect(mcpProtectedResourceMetadataUrl()).toMatch(
      /\/.well-known\/oauth-protected-resource\/api\/mcp$/
    );
  });

  it("GET /api/mcp is 401 with resource_metadata, not 405", () => {
    const response = GET();
    expect(response.status).toBe(401);
    const challenge = response.headers.get("www-authenticate") ?? "";
    expect(challenge).toContain("Bearer");
    expect(challenge).toContain("resource_metadata=");
    expect(challenge).toContain(
      "/.well-known/oauth-protected-resource/api/mcp"
    );
  });

  it("HEAD carries the same challenge without a body", () => {
    const response = HEAD();
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      mcpOAuthChallengeResponse(true).headers.get("www-authenticate")
    );
  });
});
