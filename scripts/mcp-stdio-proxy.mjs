#!/usr/bin/env node
/**
 * Local stdio MCP proxy for Grok / other stdio hosts.
 * Never opens a browser. Uses mcp-remote token files + refresh_token.
 * First login: `pnpm mcp:login` (or the mcp-remote one-shot in docs/mcp.md).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MCP_URL =
  process.env.PRECON_MCP_URL?.trim() ||
  "https://precon-data.magnus.brasfieldgorrie.app/api/mcp";
const AUTH_DIR =
  process.env.MCP_REMOTE_CONFIG_DIR?.trim() ||
  path.join(os.homedir(), ".mcp-auth");
const DURABLE_DIR =
  process.env.PRECON_MCP_HOME?.trim() || path.join(os.homedir(), ".precon-mcp");
const REQUEST_TIMEOUT_MS = Number(process.env.PRECON_MCP_TIMEOUT_MS || 25_000);

function log(message) {
  process.stderr.write(`precon-mcp: ${message}\n`);
}

function send(obj) {
  if (obj == null) return;
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function durablePaths() {
  return {
    tokenPath: path.join(DURABLE_DIR, "tokens.json"),
    clientPath: path.join(DURABLE_DIR, "client.json"),
  };
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, {
    mode: 0o600,
  });
}

function loadFrom(tokenPath, clientPath) {
  if (!fs.existsSync(tokenPath)) return null;
  const tokens = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
  if (!tokens?.access_token) return null;
  const client = fs.existsSync(clientPath)
    ? JSON.parse(fs.readFileSync(clientPath, "utf8"))
    : {};
  return { tokenPath, clientPath, tokens, client };
}

function loadFromMcpAuth() {
  const files = walkFiles(AUTH_DIR).filter((f) => f.endsWith("_tokens.json"));
  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  const tokenPath = files[0];
  if (!tokenPath) return null;
  const clientPath = tokenPath.replace(/_tokens\.json$/, "_client_info.json");
  return loadFrom(tokenPath, clientPath);
}

function persistDurable(pair) {
  const paths = durablePaths();
  writeJson(paths.tokenPath, pair.tokens);
  if (pair.client && Object.keys(pair.client).length) {
    writeJson(paths.clientPath, pair.client);
  }
  return { ...pair, tokenPath: paths.tokenPath, clientPath: paths.clientPath };
}

function loadPair() {
  const durable = loadFrom(durablePaths().tokenPath, durablePaths().clientPath);
  if (durable) return durable;
  const imported = loadFromMcpAuth();
  if (!imported) return null;
  log("imported tokens from mcp-remote cache into ~/.precon-mcp");
  return persistDurable(imported);
}

function saveTokens(tokenPath, tokens) {
  writeJson(tokenPath, tokens);
  writeJson(durablePaths().tokenPath, tokens);
}

function tokenEndpoint() {
  const origin = new URL(MCP_URL).origin;
  return `${origin}/api/auth/oauth2/token`;
}

async function refresh(pair) {
  const refreshToken = pair.tokens.refresh_token;
  const clientId = pair.client.client_id;
  if (!refreshToken || !clientId) {
    throw new Error(
      "No refresh token on disk. Run `pnpm mcp:login` once, then retry."
    );
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    resource: MCP_URL,
  });
  const response = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.access_token) {
    throw new Error(
      json?.error_description ||
        json?.error ||
        `Token refresh failed (${response.status}). Run \`pnpm mcp:login\`.`
    );
  }
  const next = {
    ...pair.tokens,
    access_token: json.access_token,
    token_type: json.token_type || pair.tokens.token_type || "Bearer",
    expires_in: json.expires_in,
    scope: json.scope || pair.tokens.scope,
    ...(json.refresh_token ? { refresh_token: json.refresh_token } : {}),
  };
  saveTokens(pair.tokenPath, next);
  pair.tokens = next;
  log("refreshed access token");
}

function parseRpcBody(text, contentType) {
  const type = contentType || "";
  if (type.includes("text/event-stream")) {
    const lines = text.split("\n");
    let last = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        const payload = trimmed.slice(5).trim();
        if (payload && payload !== "[DONE]") last = JSON.parse(payload);
      }
    }
    if (!last) throw new Error("Empty SSE body from MCP server.");
    return last;
  }
  return JSON.parse(text);
}

async function postOnce(pair, message) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${pair.tokens.access_token}`,
      "MCP-Protocol-Version": "2025-03-26",
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = parseRpcBody(text, response.headers.get("content-type"));
  } catch {
    parsed = {
      error: { message: text.slice(0, 300) || `HTTP ${response.status}` },
    };
  }
  return { response, parsed };
}

async function forward(message) {
  const pair = loadPair();
  if (!pair?.tokens?.access_token) {
    throw new Error(
      "Not signed in. In a spare terminal run `pnpm mcp:login`, complete Microsoft + Approve, wait for Connected, then Ctrl+C."
    );
  }
  let { response, parsed } = await postOnce(pair, message);
  if (response.status === 401) {
    await refresh(pair);
    ({ response, parsed } = await postOnce(pair, message));
  }
  if (!response.ok) {
    const err =
      parsed?.error?.message ||
      parsed?.error_description ||
      parsed?.error ||
      `MCP HTTP ${response.status}`;
    throw new Error(typeof err === "string" ? err : JSON.stringify(err));
  }
  return parsed;
}

function rpcError(id, message) {
  send({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code: -32003, message },
  });
}

async function handleMessage(msg) {
  if (!msg || typeof msg !== "object") return;
  const method = msg.method;
  const id = msg.id;
  if (
    method === "notifications/initialized" ||
    method === "initialized" ||
    method === "notifications/cancelled" ||
    (id === undefined && method && String(method).startsWith("notifications/"))
  ) {
    return;
  }
  if (method === "ping") {
    send({ jsonrpc: "2.0", id, result: {} });
    return;
  }
  if (id === undefined) return;
  try {
    const result = await forward(msg);
    if (result && typeof result === "object" && "jsonrpc" in result) {
      send(result);
      return;
    }
    send({ jsonrpc: "2.0", id, result });
  } catch (error) {
    rpcError(id, error instanceof Error ? error.message : String(error));
  }
}

let buf = Buffer.alloc(0);

function consume() {
  while (true) {
    const headerEnd = buf.indexOf("\r\n\r\n");
    if (headerEnd !== -1) {
      const header = buf.slice(0, headerEnd).toString("utf8");
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        buf = buf.slice(headerEnd + 4);
        continue;
      }
      const len = Number(match[1]);
      const start = headerEnd + 4;
      if (buf.length < start + len) return;
      const json = buf.slice(start, start + len).toString("utf8");
      buf = buf.slice(start + len);
      try {
        void handleMessage(JSON.parse(json));
      } catch {
        /* skip */
      }
      continue;
    }
    const nl = buf.indexOf("\n");
    if (nl === -1) return;
    const line = buf.slice(0, nl).toString("utf8").trim();
    buf = buf.slice(nl + 1);
    if (!line || line.startsWith("Content-Length")) continue;
    try {
      void handleMessage(JSON.parse(line));
    } catch {
      /* incomplete */
    }
  }
}

process.stdin.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  consume();
});
process.stdin.on("end", () => process.exit(0));
process.stdin.on("error", () => process.exit(0));
