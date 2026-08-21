import { describe, expect, it } from "vitest";
import { GET as cursorCallback } from "@/app/api/auth/native-callback/route";
import {
  bridgeCursorRedirect,
  rewriteCursorTokenBody,
  rewriteLoopbackAuthorizeUrl,
  rewriteLoopbackDcrBody,
} from "@/lib/mcp/dcr-native";

describe("rewriteLoopbackDcrBody", () => {
  it("marks omitted application_type native for 127.0.0.1 redirects", () => {
    expect(
      rewriteLoopbackDcrBody({
        client_name: "grok",
        redirect_uris: ["http://127.0.0.1:54321/callback"],
      })
    ).toMatchObject({
      application_type: "native",
      token_endpoint_auth_method: "none",
    });
  });

  it("adds refresh scope without changing https web client type", () => {
    const body = {
      client_name: "grok-web",
      redirect_uris: ["https://grok.com/oauth/callback"],
    };
    expect(rewriteLoopbackDcrBody(body)).toEqual({
      ...body,
      scope: "offline_access",
    });
  });

  it("adds refresh scope without marking mixed redirects native", () => {
    const body = {
      redirect_uris: [
        "http://127.0.0.1:54321/callback",
        "https://grok.com/oauth/callback",
      ],
    };
    expect(rewriteLoopbackDcrBody(body)).toEqual({
      ...body,
      scope: "offline_access",
    });
  });

  it("adds offline_access to native DCR scope so refresh tokens can issue", () => {
    expect(
      rewriteLoopbackDcrBody({
        redirect_uris: ["http://localhost:27523/oauth/callback"],
        scope: "profile:read read:pursuits",
      })
    ).toMatchObject({
      application_type: "native",
      scope: "profile:read read:pursuits offline_access",
    });
  });

  it("bridges Cursor's fixed private-use callback through registered HTTPS", () => {
    const cursorUri = "cursor://anysphere.cursor-mcp/oauth/callback";
    const origin = "https://precon.example";
    const bridge = bridgeCursorRedirect(cursorUri, origin);
    expect(bridge).toBe(
      "https://precon.example/api/auth/native-callback?redirect_uri=cursor%3A%2F%2Fanysphere.cursor-mcp%2Foauth%2Fcallback"
    );
    expect(
      rewriteLoopbackDcrBody(
        {
          redirect_uris: [cursorUri],
          token_endpoint_auth_method: "none",
        },
        origin
      )
    ).toMatchObject({
      application_type: "native",
      redirect_uris: [bridge],
      token_endpoint_auth_method: "none",
    });
  });

  it("forces native when Cursor claims web with a localhost callback", () => {
    expect(
      rewriteLoopbackDcrBody({
        application_type: "web",
        redirect_uris: ["http://localhost:8787/callback"],
      })
    ).toMatchObject({
      application_type: "native",
      token_endpoint_auth_method: "none",
      redirect_uris: ["http://localhost:8787/callback"],
    });
  });

  it("forces native for mixed Cursor and localhost redirects", () => {
    const cursorUri = "cursor://anysphere.cursor-mcp/oauth/callback";
    const origin = "https://precon.example";
    expect(
      rewriteLoopbackDcrBody(
        {
          application_type: "web",
          redirect_uris: [cursorUri, "http://localhost:8787/callback"],
        },
        origin
      )
    ).toMatchObject({
      application_type: "native",
      redirect_uris: [
        bridgeCursorRedirect(cursorUri, origin),
        "http://localhost:8787/callback",
      ],
    });
  });

  it("uses the same Cursor bridge for authorize and token exchange", () => {
    const cursorUri = "cursor://anysphere.cursor-mcp/oauth/callback";
    const authorize = rewriteLoopbackAuthorizeUrl(
      new URL(
        `https://precon.example/api/auth/oauth2/authorize?redirect_uri=${encodeURIComponent(cursorUri)}`
      )
    );
    const token = rewriteCursorTokenBody(
      new URLSearchParams({ redirect_uri: cursorUri }),
      "https://precon.example"
    );
    expect(authorize.searchParams.get("redirect_uri")).toBe(
      token.get("redirect_uri")
    );
  });

  it("hands an HTTPS OAuth response back to Cursor's native callback", () => {
    const response = cursorCallback(
      new Request(
        "https://precon.example/api/auth/native-callback?redirect_uri=cursor%3A%2F%2Fanysphere.cursor-mcp%2Foauth%2Fcallback&code=abc&state=xyz&iss=https%3A%2F%2Fprecon.example%2Fapi%2Fauth"
      )
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "cursor://anysphere.cursor-mcp/oauth/callback?code=abc&state=xyz&iss=https%3A%2F%2Fprecon.example%2Fapi%2Fauth"
    );
  });

  it("injects offline_access on loopback authorize requests", () => {
    const url = new URL(
      "https://precon.example/api/auth/oauth2/authorize?response_type=code&client_id=abc&redirect_uri=http%3A%2F%2Flocalhost%3A27523%2Foauth%2Fcallback&scope=profile%3Aread+read%3Apursuits"
    );
    expect(rewriteLoopbackAuthorizeUrl(url).searchParams.get("scope")).toBe(
      "profile:read read:pursuits offline_access"
    );
  });

  it("adds offline_access to https authorize scopes", () => {
    const url = new URL(
      "https://precon.example/api/auth/oauth2/authorize?redirect_uri=https%3A%2F%2Fgrok.com%2Fcb&scope=profile:read"
    );
    expect(rewriteLoopbackAuthorizeUrl(url).searchParams.get("scope")).toBe(
      "profile:read offline_access"
    );
  });
});
