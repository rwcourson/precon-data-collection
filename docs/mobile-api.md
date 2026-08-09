# Mobile API contract

Base URL: same as the web app (e.g. `https://precon.brasfieldgorrie.app` or `http://localhost:3000`).

All mobile routes live under `/api/v1/mobile/*`.

## Auth

```
Authorization: Bearer <token>
```

Optional workspace header (mirrors web workspace cookie):

```
X-Workspace-Region: Central | corporate | …
```

### Demo login (AUTH_MODE=demo only)

`POST /api/v1/mobile/auth/demo`

```json
{ "userId": 1 }
```

Returns `{ "token": "pcn_…", "user": { … } }`. Returns **403** when `AUTH_MODE` is not `demo`.

### Me

`GET /api/v1/mobile/me` — **401** without bearer; **200** with user + workspace.

### Personas

`GET /api/v1/mobile/users` — demo only.

### API tokens

Existing Admin-minted `pcn_*` tokens work; principal is the token’s `createdById` user. Server-side RBAC still applies via domain actions.

## Error shape

```json
{ "error": "message", "code": "FORBIDDEN|BAD_REQUEST|…", "details": …, "missingFields": [] }
```

## Surfaces

| Area | Methods |
|---|---|
| Overview (home KPIs) | `GET /overview` |
| Bid schedule | `GET /bid-schedule` |
| Pursuits | `POST /pursuits` |
| Jobs | `GET /jobs/:id` |
| Rounds | `GET|PUT /rounds/:id`, `POST /rounds/:id/approve-lock`, `POST /rounds/:id/outcome` |
| Sheets | `GET|POST /sheets`, `GET|PATCH /sheets/:id` |
| Dashboards | `GET|POST|PATCH /dashboards`, `GET /dashboards/:id` |
| Forecast | `GET /forecast` |
| Reconciliation | `GET|POST /reconciliation` |
| Copilot | `POST /copilot` |
| Reports | `GET|POST /reports`, `GET /reports/annual` |
| Admin | `GET|POST /admin` |
| Trash | `GET|POST /trash` |
| Search / notifications | `GET /search`, `GET|POST /notifications` |
| Workspace | `POST /workspace` |

Handlers wrap existing `src/actions/*` and `src/lib/*` — no business-logic fork.
