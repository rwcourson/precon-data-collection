# Magnus / agent API contract

Scoped API tokens (`Admin → API Tokens`) are the safe surface for Magnus and
other agents. Tokens are hashed at rest; the plaintext secret is shown once.

## Auth

```
Authorization: Bearer pcn_<secret>
```

## Scopes

| Scope | Capability |
|---|---|
| `read:pursuits` | List jobs/rounds |
| `read:reports` | Report metadata |
| `read:dashboards` | Dashboard metadata |
| `write:pursuits` | Non-destructive writes |
| `write:destructive` | Soft-delete / permanent ops (challenge required) |
| `admin:tokens` | Token administration |

Default recommendation for Magnus: **read scopes only**.

MCP clients (Claude, Cursor, Grok on the web, Inspector) do **not** use `pcn_` tokens. They use Entra OAuth against `POST /api/mcp`. Grok CLI native HTTP OAuth does not complete in 1.0.5 — see [mcp.md](mcp.md#grok-cli--known-limitation-no-browser).

## Endpoints

- `GET /api/v1/pursuits` — region-filtered pursuits (`read:pursuits`)
  - Pagination: `?limit` (default and max **200**) and `?offset`. Response keeps
    `{ data, count }` and adds `limit`, `offset`, and `nextOffset` (`null` on the
    last page).
- `POST /api/v1/destructive/challenge` — mint one-time challenge (`write:destructive`)
  - Body: `{ "operation": "soft_delete_job" }`
  - Pass returned value as `X-Destructive-Challenge` on the mutating call

## AI view suggestions (E5)

Suggested views/dashboards must:

1. Use allowlisted fields/operators only (`src/lib/dashboard-domain.ts`)
2. Require a human to review and save before publish
3. Never execute writes autonomously

## Eve copilot tools (Principal bridge)

The web UI is `/copilot`. Locally, Eve is a sibling process (`withEve()`). On Vercel it is not; the page falls back to Magnus. Either path uses the same data tools.

```
POST /api/v1/copilot/tools
Content-Type: application/json
x-eve-principal-id: <integer users.id>
x-eve-ts: <epoch milliseconds>
x-eve-hmac: <hex HMAC-SHA256 of "ts:principalId:tool:sha256(rawBody)">
x-eve-workspace: <region or empty for corporate>

{ "tool": "query_needs_staffing", "input": {} }
```

The signing key is derived from `BETTER_AUTH_SECRET` (then `AI_GATEWAY_API_KEY`)
with the fixed label `copilot-tools-v1`, so tool signatures are never valid
against Better Auth sessions. The signature binds the timestamp, principal,
tool, and the SHA-256 of the exact raw body; requests older than **120 s** are
rejected (replay window). Non-integer principal ids, stale timestamps, body
tampering, and missing HMAC all return **401**. Signer: `agent/lib/app-bridge.ts`;
verifier: `src/lib/ai/copilot-bridge.ts`. Tools: `query_efforts`,
`query_needs_staffing`, `search_notes`, `person_history`, `plan_chart`.
Implementation: `src/services/copilot-query-service.ts`.

Identity for Eve: `GET /api/v1/copilot/identity` (session cookie). Do not use Eve `localDev()`.

## Streaming Magnus chat (AI SDK 7)

The Eve copilot UI lives at `/copilot` (`useEveAgent` → `/eve/v1/*` when healthy).
Threads persist per user in the browser (`localStorage`, `src/lib/copilot-history.ts`); they are not a server resource.
Magnus remains the API/mobile fallback and streams via:

```
POST /api/v1/ai/magnus
Content-Type: application/json

{
  "messages": [ /* UIMessage[] from useChat */ ],
  "previousPlan": null | { name, description, scope, widgets, … }
}
```

- Auth: same session principal as the web app (not bearer token).
- Model: Claude Opus 5 via AI Gateway with **zero data retention** (`src/lib/ai/gateway.ts`).
- Agent: AI SDK 7 `ToolLoopAgent` with tools:
  - `get_portfolio_brief` — scoped portfolio snapshot
  - `answer_metric` — single allowlisted metric
  - `plan_dashboard` — Power BI–style multi-widget plan + resolved series
  - `refine_dashboard` — iterate on the last canvas plan
  - `plan_dashboard_rules` — local rules planner (also used when gateway key is missing)
- Charts: `@rwcourson/chart-elements` on the canvas; series colors come from the shared tokens in `src/app/globals.css` (see `docs/color-system.md`).
- Writes: still require the human **Save view** action (`saveCopilotDashboard`).

Bearer suggest-view remains for external Magnus integrations:

```
POST /api/v1/ai/suggest-view
Authorization: Bearer pcn_…
{ "prompt": "region scorecard" }
```

## Destructive guardrails

No destructive API call succeeds without:

1. Token scope `write:destructive`
2. A fresh, unused challenge for that exact operation
3. An audit log row naming the token prefix and change summary
