# Legacy authorization migration inventory

Phase 3 freezes every legacy permission helper and direct-by-ID loader in
`src/lib/authorization/legacy-inventory.ts`. The architecture test scans the
source tree and fails if a new caller appears; removal is always allowed.

| Inventory | Migration owner | Rule |
|---|---|---|
| Role-only read and UI checks | Phase 5 | Replace with principal plus scoped resource loader; UI checks consume kernel decisions. |
| Server-action mutation checks | Phase 6 | Move behind explicit-principal application services. |
| Transaction-adjacent ID reloads | Phase 7 | Keep authorization predicate inside the transaction. |
| Trash/recovery ID reads | Phase 8 | Use deleted-state resource loaders and restore/permanent-delete capabilities. |
| Integration/admin ID reads | Phase 10 | Use service principals and integrate capability. |
| Display-only role labels and status transitions | Phase 14 | Remove authorization meaning or render kernel decisions supplied by the server. |

The symbol inventory covers the old pursuit, schedule, post-bid, approval,
column, audit, field, sheet, and lifecycle helpers. The direct-loader inventory
contains the exact current file list. Predictable-ID route/page reads already
migrated in Phase 3 are deliberately absent.
