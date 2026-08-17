# Authorization inventory

The kernel (`src/lib/authorization/kernel.ts` `authorize()`) is the only
capability decision API. Server actions resolve a `Principal` via
`getWebPrincipal()` and pass it to services. Compatibility wrappers in
`src/lib/permissions.ts` exist for tests; production code must not import them.

## Role × capability matrix

Roles: `pcm` · `estimate_lead` · `admin_jsa` · `rpd` · `leadership` · `corporate_admin`.

Region gate runs first: a principal whose `allowedRegions` does not include the
resource region is denied (`reason: region`) for every capability.

| Capability | pcm | estimate_lead | admin_jsa | rpd | leadership | corporate_admin | Notes |
|---|---|---|---|---|---|---|---|
| `read` job/round | yes | yes | yes | yes | yes | yes | Region-scoped |
| `edit` job/round | yes | yes | yes | yes | no | no* | *corporate_admin is granted create/schedule via `decisions.ts` without widening kernel `edit` |
| `edit` field (core, pre-bid) | yes | yes | yes | yes | no | yes | Field policy |
| `edit` field (post-bid) | no | yes | yes | yes | no | yes | submitted / post_bid |
| `edit` field (locked) | no | no | no | yes | no | yes | RPD corrections |
| `approve` (lock) | no | no | no | yes | no | yes | Round must be `post_bid` |
| `manage` admin (company) | no | no | no | no | no | yes | lists, tokens, people, access |
| `edit` admin (regional) | no | no | some | yes | no | yes | admin_jsa: salesforce/quality; not columns/promotions/notifications |
| `distribute` | no | no | no | yes | no | yes | |
| `integrate` | no | no | yes | yes | no | yes | |
| `restore` | no | no | yes | yes | no | yes | |
| `permanent-delete` | no | no | no | no | no | yes | |
| `notes.write` / `notes.attach` | yes | yes | yes | yes | yes | yes | Anyone who can read the round |
| `visibility.manage-region` | yes | yes | yes | yes | no | no | Own region only (region gate) |
| `visibility.assign-user` | no | no | no | no | no | yes | Pin a person onto a job |
| `staffing.mark` | yes | yes | yes | yes | no | no | Team-assigned flag |
| `dashboards.manage-standard` | no | no | no | no | no | yes | Seeded standard dashboards |
| `reports.schedule` | yes | yes | yes | yes | yes | yes | Self-serve report email |

Directors (`pcm`, `estimate_lead`, `admin_jsa`, `rpd`) may toggle **only their
own region** onto a job (`visibility.manage-region`). Cross-region attempts
fail the region gate. Admins pin people with `visibility.assign-user`.

## Legacy policy callers

**None.** Production files no longer import `@/lib/permissions` or
`@/lib/policy`. Display labels live in `src/lib/labels.ts`. Status transitions
live in `src/lib/authorization/lifecycle.ts`. UI checks consume
`src/lib/authorization/decisions.ts`.

## Direct-by-ID loaders (justified survivors)

These still match `\.where(eq\([^,]+\.id` and remain inventoried in
`legacy-inventory.ts`:

| File | Why it stays |
|---|---|
| `src/actions/admin.ts` | Reference-list / column row updates by primary key after a kernel admin check |
| `src/actions/api-tokens.ts` | Token revoke by id after `manage` on admin/tokens |
| `src/actions/dashboards.ts` | Widget row updates keyed by dashboard id after `loadDashboardForPrincipal` |
| `src/actions/data-quality.ts` | Flag row updates by id after quality `edit` |
| `src/actions/distribution.ts` | Distribution list row updates after `distribute` |
| `src/actions/governance.ts` | Promotion / ACL row updates after promotions `edit`/`manage` |
| `src/actions/people.ts` | User row updates after people `manage` |
| `src/actions/reports.ts` | Saved-report updates after `loadReportForPrincipal` |
| `src/actions/salesforce-inbox.ts` | Match-candidate updates after salesforce `edit` |
| `src/actions/sheets.ts` | Sheet row/column mutations after `loadSheetForPrincipal` |
| `src/actions/templates.ts` | Personal template delete by id + owner check |
| `src/lib/auth.ts` | SSO user lookup by Better Auth id (identity bootstrap, not authorization) |
| `src/lib/email.ts` | Outbox row claim by id |
| `src/lib/export-jobs.ts` | In-memory job map, not a resource loader |
| `src/lib/mobile-auth.ts` | Demo session token lookup (identity bootstrap) |
| `src/lib/queries.ts` | Shared lookup helpers used by loaders |
| `src/lib/recovery.ts` | Trash restore paths; kernel restore/permanent-delete already wrap them |

Identity bootstrap (`getCurrentUser` in `web-principal.ts` / `current-user.ts`)
is the transport adapter. Application services never call it.
