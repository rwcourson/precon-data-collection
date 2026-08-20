import { describe, expect, it } from "vitest";
import {
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

  it("does not rewrite https web callbacks", () => {
    const body = {
      client_name: "grok-web",
      redirect_uris: ["https://grok.com/oauth/callback"],
    };
    expect(rewriteLoopbackDcrBody(body)).toEqual(body);
  });

  it("does not rewrite mixed loopback and https redirects", () => {
    const body = {
      redirect_uris: [
        "http://127.0.0.1:54321/callback",
        "https://grok.com/oauth/callback",
      ],
    };
    expect(rewriteLoopbackDcrBody(body)).toEqual(body);
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

  it("injects offline_access on loopback authorize requests", () => {
    const url = new URL(
      "https://precon.example/api/auth/oauth2/authorize?response_type=code&client_id=abc&redirect_uri=http%3A%2F%2Flocalhost%3A27523%2Foauth%2Fcallback&scope=profile%3Aread+read%3Apursuits"
    );
    expect(rewriteLoopbackAuthorizeUrl(url).searchParams.get("scope")).toBe(
      "profile:read read:pursuits offline_access"
    );
  });

  it("leaves https authorize scopes untouched", () => {
    const url = new URL(
      "https://precon.example/api/auth/oauth2/authorize?redirect_uri=https%3A%2F%2Fgrok.com%2Fcb&scope=profile:read"
    );
    expect(rewriteLoopbackAuthorizeUrl(url)).toEqual(url);
  });
});
