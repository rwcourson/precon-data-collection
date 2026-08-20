import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNdjsonParser,
  encodeStdioMessage,
  parseRemoteMessages,
  pollDeviceToken,
  refreshAccessToken,
  writeJsonAtomic,
} from "../../../scripts/mcp-stdio-proxy.mjs";

const temporaryDirectories: string[] = [];

function temporaryHome(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "precon-mcp-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("repo-local MCP companion", () => {
  it("emits MCP stdio as one newline-delimited JSON message", () => {
    const encoded = encodeStdioMessage({
      jsonrpc: "2.0",
      id: 1,
      result: { value: "line one\nline two" },
    });
    expect(encoded.endsWith("\n")).toBe(true);
    expect(encoded).not.toContain("Content-Length:");
    expect(encoded.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(encoded)).toMatchObject({ id: 1 });
  });

  it("parses fragmented and multiple NDJSON input messages", () => {
    const messages: unknown[] = [];
    const parser = createNdjsonParser((message: unknown) =>
      messages.push(message)
    );
    parser(Buffer.from('{"jsonrpc":"2.0","id":1'));
    parser(
      Buffer.from(
        ',"method":"initialize"}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n'
      )
    );
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ id: 1, method: "initialize" });
  });

  it("parses every JSON-RPC message in an SSE response", () => {
    expect(
      parseRemoteMessages(
        'event: message\ndata: {"jsonrpc":"2.0","method":"progress"}\n\ndata: {"jsonrpc":"2.0","id":1,"result":{}}\n',
        "text/event-stream"
      )
    ).toEqual([
      { jsonrpc: "2.0", method: "progress" },
      { jsonrpc: "2.0", id: 1, result: {} },
    ]);
  });

  it("writes credential files atomically with owner-only permissions", () => {
    const filePath = path.join(temporaryHome(), "tokens.json");
    writeJsonAtomic(filePath, { access_token: "secret" });
    expect(JSON.parse(fs.readFileSync(filePath, "utf8"))).toEqual({
      access_token: "secret",
    });
    expect(fs.statSync(filePath).mode & 0o777).toBe(0o600);
  });

  it("polls pending device authorization and persists the approved grant", async () => {
    const home = temporaryHome();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "authorization_pending",
            error_description: "Pending",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access",
            refresh_token: "refresh",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const tokens = await pollDeviceToken(
      { client_id: "client" },
      {
        device_code: "device",
        user_code: "USER",
        interval: 1,
        expires_in: 30,
      },
      {
        env: { PRECON_MCP_HOME: home },
        sleep: async () => undefined,
      }
    );

    expect(tokens).toMatchObject({
      access_token: "access",
      refresh_token: "refresh",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(fs.readFileSync(path.join(home, "tokens.json"), "utf8"))
    ).toMatchObject({ refresh_token: "refresh" });
  });

  it("rotates refresh tokens without losing the prior token when omitted", async () => {
    const home = temporaryHome();
    writeJsonAtomic(path.join(home, "client.json"), { client_id: "client" });
    writeJsonAtomic(path.join(home, "tokens.json"), {
      access_token: "old-access",
      refresh_token: "durable-refresh",
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ access_token: "new-access", expires_in: 3600 }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
    );

    const next = await refreshAccessToken({
      env: { PRECON_MCP_HOME: home },
    });
    expect(next).toMatchObject({
      access_token: "new-access",
      refresh_token: "durable-refresh",
    });
  });
});
