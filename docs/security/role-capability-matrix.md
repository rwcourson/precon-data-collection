# Role × capability matrix

Canonical decisions live in `src/lib/authorization/kernel.ts`. This table is the
human-readable contract; tests in `authorization-policy.test.ts` enforce it.

Region gate: if the principal's `allowedRegions` does not include the resource
region, every capability is denied.

| Capability | pcm | estimate_lead | admin_jsa | rpd | leadership | corporate_admin |
|---|---|---|---|---|---|---|
| `read` job/round | Y | Y | Y | Y | Y | Y |
| `edit` job/round | Y | Y | Y | Y | N | N |
| `approve` (post_bid → lock) | N | N | N | Y | N | Y |
| `manage` company admin | N | N | N | N | N | Y |
| `edit` regional admin | N | N | limited | Y | N | Y |
| `distribute` | N | N | N | Y | N | Y |
| `integrate` | N | N | Y | Y | N | Y |
| `restore` | N | N | Y | Y | N | Y |
| `permanent-delete` | N | N | N | N | N | Y |
| `notes.write` | Y | Y | Y | Y | Y | Y |
| `notes.attach` | Y | Y | Y | Y | Y | Y |
| `visibility.manage-region` | own | own | own | own | N | N |
| `visibility.assign-user` | N | N | N | N | N | Y |
| `staffing.mark` | Y | Y | Y | Y | N | N |
| `dashboards.manage-standard` | N | N | N | N | N | Y |
| `reports.schedule` | Y | Y | Y | Y | Y | Y |

`visibility.manage-region` is own-region-only: a Georgia director cannot add
Florida. The region gate enforces that. `admin_jsa` regional-admin `edit` covers
salesforce and quality, not columns/promotions/notifications.

`manage` company admin includes **Admin → MCP Access** (kill switch, role
defaults, per-user overrides, OAuth consent revoke). MCP tool traffic uses the
same job/round capabilities plus the grant ceiling in [mcp.md](../mcp.md).

See also `docs/security/legacy-authorization-inventory.md`.
