# Remote MCP server

OAuth-gated Model Context Protocol for Precon. External AI tools (Claude, Cursor, MCP Inspector) can read — and, if an admin opts in, write — through the same authorization kernel as the web app.

This is **not** a personal-access-token product. Users do not mint MCP tokens. They sign in with Microsoft Entra, approve scopes on `/consent`, and the app re-checks the grant ceiling on every `POST /api/mcp`.

For Magnus / `pcn_` API tokens see [magnus-api.md](magnus-api.md).

## Architecture

```
MCP client
  → RFC 9728 protected-resource metadata  GET /.well-known/oauth-protected-resource
  → RFC 8414 authorization-server metadata GET /.well-known/oauth-authorization-server
  → Entra SSO at /sign-in  →  consent at /consent
  → Bearer access token
  → POST /api/mcp  (Streamable HTTP, Node runtime, POST only)
```

- Better Auth 1.7 `mcp()` **is** the OAuth 2.1 provider. Do not also register `oauthProvider()`.
- Dynamic Client Registration (RFC 7591) is advertised; CIMD is **not**. Grok CLI hangs on `[authenticating]` if metadata claims `client_id_metadata_document_supported` without a HTTPS client-metadata URL. Loopback DCR bodies are rewritten to `application_type: native`.
- Resource identifier is `${APP_ORIGIN}/api/mcp` (`mcpResourceIdentifier()`).
- The handler uses MCP SDK v2 `createMcpHandler(..., { legacy: "stateless" })`. 2025 clients that POST JSON-RPC without a 2026 `_meta` envelope still work. GET/DELETE are 405.
- Identity: OAuth claims email → app `users` row (case-insensitive). No roster row → 403. MCP does not auto-provision. Demo mode (`AUTH_MODE=demo`) has no OAuth flow.

## Permission model (four layers)

Every MCP request is the intersection of:

1. **Role capabilities** — `authorize(principal, capability, resource)` in the kernel.
2. **MCP grant ceiling** — kill switch → per-user override → per-role default (`app_settings.mcp` + `mcp_user_access`).
3. **OAuth-granted scopes** — what the user consented to on `/consent`.
4. **Region allowlist** — same visibility SQL as the rest of the app.

The ceiling is re-checked on every request. Flipping the kill switch or a user override denies the **next** call; you do not wait for the access token to expire.

### Grantable scopes

| Scope | Meaning |
| --- | --- |
| `profile:read` | Name, role, home region |
| `read:pursuits` | Jobs, rounds, notes, staffing |
| `write:pursuits` | Append notes and update allowlisted pursuit fields |
| `read:reports` | Reports |
| `read:dashboards` | Dashboards and chart plans |
| `read:sheets` | Sheets |

Default when admin has configured nothing: MCP **on**, every role gets the five **read** scopes, **no** `write:pursuits`.

### Never grantable

Anything else on `ApiTokenScope` is stripped, including `write:destructive`, `read:admin`, `write:admin`, `admin:tokens`, `read:trash`, `write:trash`, `read:notifications`, `write:notifications`, `integrate:connect`, and write variants of reports/dashboards/sheets.

MCP principals use `authSource: "mcp"` with a **non-null** token so kernel `tokenAllows` runs. Do not construct `authSource: "service"` (token null skips scopes).

## v1 tool catalog

| Tool | Required scope | Read/write | Notes |
| --- | --- | --- | --- |
| `whoami` | `profile:read` | read | Identity + effective scopes |
| `query_efforts` | `read:pursuits` | read | `copilotQueryService.queryEfforts` |
| `query_needs_staffing` | `read:pursuits` | read | Upcoming unstaffed efforts |
| `search_notes` | `read:pursuits` | read | Note excerpts + citations |
| `person_history` | `read:pursuits` | read | Lead/staffed efforts by person |
| `get_job` | `read:pursuits` | read | Visibility-scoped job |
| `get_round` | `read:pursuits` | read | Visibility-scoped round |
| `plan_chart` | `read:dashboards` | read | Draft chart plan, does not save |
| `append_note` | `write:pursuits` | write | Round notes only; confirm `roundId` first. Not idempotent. |
| `update_pursuit_fields` | `write:pursuits` | write | Last-write-wins. Allowlist: `owner`, `city`, `state`, `preconDepartment`, `estimatePhase`, `bidDueDate`, `drawingsDueDate`, `bidReviewDate`, `projectStartDate`, `mlt`, `marketSector`, `contractType`, `procurement`, `designContract`, `statusAtPricing`. No status, outcome, region, lock, or estimate lead. Locked rounds are denied. |

Leadership can hold `write:pursuits` and still be denied by the kernel (`edit` is PCM / estimate lead / admin_jsa / RPD only). Notes writes follow `notes.write` (in-region roles).

## Admin runbook

Path: **Admin → MCP Access** (Corporate Precon Admin only).

1. **Kill switch** — `app_settings.mcp.enabled`. Off denies every role, including Corporate Admin, on the next request.
2. **Role defaults** — grid of the six grantable scopes. Writes stay unchecked until you opt a role in.
3. **Per-user override** — inherit (no `mcp_user_access` row), explicit ceiling, or disable. Inherit is visually distinct from an explicit grant.
4. **Connected clients** — OAuth consents (client, user, scopes, last used). Admin revoke marks access/refresh tokens revoked and deletes the consent.
5. **Audit** — `audit_log` rows with `entity = mcp_tool`, `action` allowed/denied, `field` = tool name, `old_value` = client id, `new_value` = reason, `userId` = app user.

User self-service: **AI connections** at `/settings/connections` (header link). Users can revoke their own clients.

## Client setup

Server URL (this environment): `{APP_ORIGIN}/api/mcp`. Copy it from **AI connections** — the page derives it from runtime config, not a hardcoded host.

OAuth discovery (no cookies required):

- `GET {APP_ORIGIN}/.well-known/oauth-protected-resource`
- `GET {APP_ORIGIN}/.well-known/oauth-authorization-server`

### Claude Desktop / Claude Code

1. Add a custom MCP connector / remote server.
2. URL: `{APP_ORIGIN}/api/mcp`.
3. Complete Microsoft sign-in, then the Precon consent page.
4. Approve only the scopes you need. Writes require an admin ceiling **and** consent.

### Cursor

1. Settings → MCP → add a remote server with the URL above.
2. Same Entra + consent flow.
3. After connecting, `whoami` should list your role and effective scopes.

### Grok (web)

1. Open [grok.com/connectors](https://grok.com/connectors) → **New Connector** → **Custom**.
2. URL: `{APP_ORIGIN}/api/mcp`.
3. Complete Microsoft sign-in and Precon consent.

### Grok CLI

```bash
grok mcp add --transport http precon {APP_ORIGIN}/api/mcp
grok
```

In the TUI: `/mcps`, highlight **precon**, press **`i`**. A browser should open. `grok mcp doctor` does **not** start OAuth; it only checks connectivity.

If the TUI stays on `[authenticating]` with no browser, quit Grok fully and retry after the server advertises `registration_endpoint` **without** `client_id_metadata_document_supported`. Grok CLI chooses CIMD when that flag is on and never opens a login URL. Loopback DCR clients are treated as native (`http://127.0.0.1` redirects).

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector {APP_ORIGIN}/api/mcp
```

Inspector will follow protected-resource metadata, open the browser for SSO, then `tools/list`.

## Troubleshooting

| Symptom | Meaning |
| --- | --- |
| HTTP 401 + `WWW-Authenticate: Bearer` | Missing, expired, or revoked access token. Reconnect. |
| HTTP 403, message about roster | Microsoft email is not in app `users`. Ask an admin to add you. Do not expect auto-provision. |
| HTTP 403, message about disabled | Kill switch or per-user disable. Admin → MCP Access. |
| Tool missing from `tools/list` | Scope not in the effective intersection (ceiling ∩ consent). |
| JSON-RPC error `Missing MCP grant: write:pursuits` | Write tool called without a write ceiling and consent. |
| HTTP 400 `missing: ["_meta"]` | Client sent `MCP-Protocol-Version: 2026-07-28` without the per-request envelope. Omit the header (2025) or send `_meta`. |
| Grok CLI `[authenticating]` with no browser | CIMD advertised, or DCR rejected loopback as a web client. Metadata must omit `client_id_metadata_document_supported` and accept `http://127.0.0.1` via native DCR. Quit the TUI and press `i` again. |
| Build log `relation "oauth_resource" does not exist` | Apply drizzle migration 0016 (`pnpm run db:migrate:deploy`) before first SSO runtime on Postgres. CI uses PGlite and is clean. |

## Rate limiting

`/api/mcp` does not have a dedicated per-principal rate limiter today. Platform DDoS/WAF (Vercel) still applies. Follow-up: reuse any future per-principal limiter on this route.

## Related

- [security/sso.md](security/sso.md) — Entra + Better Auth
- [security/role-capability-matrix.md](security/role-capability-matrix.md) — kernel roles
- [magnus-api.md](magnus-api.md) — `pcn_` tokens (different from MCP OAuth)
