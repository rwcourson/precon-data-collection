import { afterEach, describe, expect, it, vi } from "vitest";
import { submitOauthConsent } from "@/components/auth/consent-client";
import {
  filterConsentScopes,
  GRANTABLE_MCP_SCOPES,
  mcpScopeLabel,
  parseConsentScopes,
} from "@/lib/authorization/mcp-scopes";

describe("MCP consent helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses space and plus-delimited scope lists", () => {
    expect(
      parseConsentScopes("profile:read+read:pursuits write:pursuits")
    ).toEqual(["profile:read", "read:pursuits", "write:pursuits"]);
  });

  it("strips never-grantable scopes so consent cannot grant them", () => {
    expect(
      filterConsentScopes(
        parseConsentScopes(
          "profile:read write:destructive read:admin admin:tokens write:pursuits"
        )
      )
    ).toEqual(["profile:read", "write:pursuits"]);
  });

  it("humanizes every grantable MCP scope", () => {
    for (const scope of GRANTABLE_MCP_SCOPES) {
      const label = mcpScopeLabel(scope);
      expect(label).not.toBe(scope);
      expect(label.length).toBeGreaterThan(8);
    }
  });

  it("posts approve and deny and follows redirect_uri", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { accept: boolean };
      return new Response(
        JSON.stringify({
          redirect_uri: body.accept
            ? "https://client.example/cb?code=ok"
            : "https://client.example/cb?error=access_denied",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitOauthConsent({
        accept: true,
        oauthQuery: "client_id=x&scope=profile:read",
        scope: "profile:read",
      })
    ).resolves.toEqual({
      redirect_uri: "https://client.example/cb?code=ok",
    });

    await expect(
      submitOauthConsent({
        accept: false,
        oauthQuery: "client_id=x&scope=profile:read",
      })
    ).resolves.toEqual({
      redirect_uri: "https://client.example/cb?error=access_denied",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
