#!/usr/bin/env node
/**
 * Repo-local Precon MCP companion.
 *
 * `login` uses RFC 8628 Device Authorization: it prints one stable HTTPS URL
 * and never opens a browser or binds a localhost callback.
 * `serve` bridges spec-compliant NDJSON stdio to the remote Streamable HTTP
 * MCP endpoint and silently refreshes the stored access token.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
export const DEFAULT_MCP_URL =
  "https://precon-data.magnus.brasfieldgorrie.app/api/mcp";
export const DEFAULT_SCOPES = [
  "offline_access",
  "profile:read",
  "read:pursuits",
  "read:reports",
  "read:dashboards",
  "read:sheets",
].join(" ");

function config(env = process.env) {
  const mcpUrl = env.PRECON_MCP_URL?.trim() || DEFAULT_MCP_URL;
  const home =
    env.PRECON_MCP_HOME?.trim() || path.join(os.homedir(), ".precon-mcp");
  const origin = new URL(mcpUrl).origin;
  return {
    mcpUrl,
    home,
    clientPath: path.join(home, "client.json"),
    tokenPath: path.join(home, "tokens.json"),
    lockPath: path.join(home, "tokens.lock"),
    registerUrl: `${origin}/api/auth/oauth2/register`,
    deviceUrl: `${origin}/api/auth/device/code`,
    tokenUrl: `${origin}/api/auth/oauth2/token`,
    timeoutMs: Number(env.PRECON_MCP_TIMEOUT_MS || 25_000),
  };
}

export function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporary, filePath);
  fs.chmodSync(filePath, 0o600);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function fetchJson(url, init, timeoutMs) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

export async function registerDeviceClient(options = {}) {
  const cfg = config(options.env);
  const existing = readJson(cfg.clientPath);
  if (existing?.client_id) return existing;

  const payload = {
    client_name: "Precon MCP repo companion",
    application_type: "native",
    token_endpoint_auth_method: "none",
    redirect_uris: ["http://127.0.0.1/oauth/callback"],
    grant_types: ["authorization_code", DEVICE_GRANT_TYPE, "refresh_token"],
    response_types: ["code"],
    scope: DEFAULT_SCOPES,
  };
  const { response, body } = await fetchJson(
    cfg.registerUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    cfg.timeoutMs
  );
  if (!response.ok || !body?.client_id) {
    throw new Error(
      body?.error_description ||
        body?.error ||
        `Client registration failed (${response.status}).`
    );
  }
  writeJsonAtomic(cfg.clientPath, body);
  return body;
}

export async function requestDeviceCode(client, options = {}) {
  const cfg = config(options.env);
  const form = new URLSearchParams({
    client_id: client.client_id,
    scope: DEFAULT_SCOPES,
    resource: cfg.mcpUrl,
  });
  const { response, body } = await fetchJson(
    cfg.deviceUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    },
    cfg.timeoutMs
  );
  if (!response.ok || !body?.device_code || !body?.user_code) {
    throw new Error(
      body?.error_description ||
        body?.error ||
        `Device authorization failed (${response.status}).`
    );
  }
  return body;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollDeviceToken(client, device, options = {}) {
  const cfg = config(options.env);
  const deadline =
    Date.now() + Math.max(1, Number(device.expires_in || 1800)) * 1000;
  let intervalMs = Math.max(1, Number(device.interval || 5)) * 1000;
  while (Date.now() < deadline) {
    await (options.sleep ?? sleep)(intervalMs);
    const form = new URLSearchParams({
      grant_type: DEVICE_GRANT_TYPE,
      device_code: device.device_code,
      client_id: client.client_id,
      resource: cfg.mcpUrl,
    });
    const { response, body } = await fetchJson(
      cfg.tokenUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      },
      cfg.timeoutMs
    );
    if (response.ok && body?.access_token) {
      const tokens = { ...body, obtained_at: Date.now() };
      writeJsonAtomic(cfg.tokenPath, tokens);
      return tokens;
    }
    if (body?.error === "authorization_pending") continue;
    if (body?.error === "slow_down") {
      intervalMs += 5_000;
      continue;
    }
    throw new Error(
      body?.error_description ||
        body?.error ||
        `Token exchange failed (${response.status}).`
    );
  }
  throw new Error(
    "Device code expired before it was approved. Run login again."
  );
}

export async function login(options = {}) {
  const output =
    options.output ?? ((line) => process.stderr.write(`${line}\n`));
  const client = await registerDeviceClient(options);
  const device = await requestDeviceCode(client, options);
  output("Authorize the Precon MCP connection:");
  output(device.verification_uri_complete || device.verification_uri);
  if (!device.verification_uri_complete) output(`Code: ${device.user_code}`);
  output("Waiting for approval…");
  await pollDeviceToken(client, device, options);
  output("Connected. The companion can now run without opening a browser.");
}

async function withFileLock(cfg, callback) {
  fs.mkdirSync(cfg.home, { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const fd = fs.openSync(cfg.lockPath, "wx", 0o600);
      try {
        return await callback();
      } finally {
        fs.closeSync(fd);
        fs.rmSync(cfg.lockPath, { force: true });
      }
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const age = Date.now() - fs.statSync(cfg.lockPath).mtimeMs;
      if (age > 30_000) fs.rmSync(cfg.lockPath, { force: true });
      else await sleep(50);
    }
  }
  throw new Error("Timed out waiting for the token refresh lock.");
}

export async function refreshAccessToken(options = {}) {
  const cfg = config(options.env);
  return withFileLock(cfg, async () => {
    const current = readJson(cfg.tokenPath);
    const client = readJson(cfg.clientPath);
    if (!current?.refresh_token || !client?.client_id) {
      throw new Error("No refresh grant is available. Run `pnpm mcp:login`.");
    }
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refresh_token,
      client_id: client.client_id,
      resource: cfg.mcpUrl,
    });
    const { response, body } = await fetchJson(
      cfg.tokenUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      },
      cfg.timeoutMs
    );
    if (!response.ok || !body?.access_token) {
      throw new Error(
        body?.error_description ||
          body?.error ||
          `Token refresh failed (${response.status}). Run \`pnpm mcp:login\`.`
      );
    }
    const next = {
      ...current,
      ...body,
      refresh_token: body.refresh_token || current.refresh_token,
      obtained_at: Date.now(),
    };
    writeJsonAtomic(cfg.tokenPath, next);
    return next;
  });
}

export function parseRemoteMessages(text, contentType = "") {
  if (contentType.includes("text/event-stream")) {
    return text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter((line) => line && line !== "[DONE]")
      .map((line) => JSON.parse(line));
  }
  if (!text.trim()) return [];
  return [JSON.parse(text)];
}

async function postMessage(message, tokens, cfg) {
  return fetch(cfg.mcpUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-03-26",
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });
}

export async function forwardMessage(message, options = {}) {
  const cfg = config(options.env);
  let tokens = readJson(cfg.tokenPath);
  if (!tokens?.access_token) {
    throw new Error("Not signed in. Run `pnpm mcp:login` once.");
  }
  const expiresAt =
    Number(tokens.obtained_at || 0) + Number(tokens.expires_in || 0) * 1000;
  if (expiresAt && expiresAt <= Date.now() + 30_000) {
    tokens = await refreshAccessToken(options);
  }

  let response = await postMessage(message, tokens, cfg);
  if (response.status === 401) {
    tokens = await refreshAccessToken(options);
    response = await postMessage(message, tokens, cfg);
  }
  const text = await response.text();
  if (!response.ok) {
    let detail = text.slice(0, 500);
    try {
      const parsed = JSON.parse(text);
      detail =
        parsed?.error?.message ||
        parsed?.error_description ||
        parsed?.error ||
        detail;
    } catch {
      // Keep the bounded text response.
    }
    throw new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail)
    );
  }
  return parseRemoteMessages(text, response.headers.get("content-type") || "");
}

export function encodeStdioMessage(message) {
  return `${JSON.stringify(message)}\n`;
}

export function createNdjsonParser(onMessage, onError = () => {}) {
  let buffer = "";
  return (chunk) => {
    buffer += chunk.toString("utf8");
    while (true) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      try {
        onMessage(JSON.parse(line));
      } catch (error) {
        onError(error);
      }
    }
  };
}

export function serve(options = {}) {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const errors = options.errors ?? process.stderr;
  let queue = Promise.resolve();
  const parser = createNdjsonParser(
    (message) => {
      queue = queue
        .then(async () => {
          const responses = await forwardMessage(message, options);
          for (const response of responses) {
            output.write(encodeStdioMessage(response));
          }
        })
        .catch((error) => {
          if (message.id !== undefined) {
            output.write(
              encodeStdioMessage({
                jsonrpc: "2.0",
                id: message.id ?? null,
                error: {
                  code: -32003,
                  message:
                    error instanceof Error ? error.message : String(error),
                },
              })
            );
          } else {
            errors.write(
              `precon-mcp: ${error instanceof Error ? error.message : String(error)}\n`
            );
          }
        });
    },
    (error) => errors.write(`precon-mcp: invalid JSON: ${error.message}\n`)
  );
  input.on("data", parser);
  input.on("error", (error) =>
    errors.write(`precon-mcp: stdin error: ${error.message}\n`)
  );
}

async function main() {
  const command = process.argv[2] || "serve";
  if (command === "login") await login();
  else if (command === "serve") serve();
  else {
    throw new Error("Usage: mcp-stdio-proxy.mjs [login|serve]");
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    process.stderr.write(
      `precon-mcp: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
