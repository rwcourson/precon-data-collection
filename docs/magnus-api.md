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

## Endpoints

- `GET /api/v1/pursuits` — region-filtered pursuits (`read:pursuits`)
- `POST /api/v1/destructive/challenge` — mint one-time challenge (`write:destructive`)
  - Body: `{ "operation": "soft_delete_job" }`
  - Pass returned value as `X-Destructive-Challenge` on the mutating call

## AI view suggestions (E5)

Suggested views/dashboards must:

1. Use allowlisted fields/operators only (`src/lib/dashboard-domain.ts`)
2. Require a human to review and save before publish
3. Never execute writes autonomously

## Destructive guardrails

No destructive API call succeeds without:

1. Token scope `write:destructive`
2. A fresh, unused challenge for that exact operation
3. An audit log row naming the token prefix and change summary
