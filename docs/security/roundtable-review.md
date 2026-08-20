# Roundtable security review

Review of the 19 Aug roundtable surfaces. Authorization remains kernel-only.

| Area | Check |
| --- | --- |
| Direct Server Actions | Create/edit/approve/unlock/import call `getWebPrincipal()` then a service that uses `Principal` |
| PCM Copilot / Tools | Chrome hides links; `roleMayAccessPath` denies `/copilot`, `/dashboards`, `/admin` for PCM/lead |
| Approvals | Draft creates stay in `approval_requests` until RPD/SPD decide; duplicate check covers pending payloads |
| IDOR | Round/job loaders use visibility predicates; unlock is RPD/corporate_admin only |
| Import validation | Destini preview/confirm uses the existing diff engine; local-wins preserved |
| Warehouse | `DATABRICKS_ALLOW_WRITE` kill switch; MERGE by round + lock revision; retract marks superseded |
| Warehouse privileges | Service principal gets only the minimum Unity Catalog rights on the locked shadow table (`USE CATALOG`/`USE SCHEMA` plus `SELECT`/`MODIFY` on that table). No catalog-wide `ALL PRIVILEGES`. Secrets stay in platform configuration, not the repo. |
| External AI | Magnus/MCP/`api_token` answers are locked-revision scoped; operator session Copilot stays separately authorized |
| Preview isolation | Preview postgres URLs must differ from `PRODUCTION_DATABASE_URL` |
