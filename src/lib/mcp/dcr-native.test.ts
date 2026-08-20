import { describe, expect, it } from "vitest";
import { rewriteLoopbackDcrBody } from "@/lib/mcp/dcr-native";

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
});
