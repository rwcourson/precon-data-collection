# ADR-005: Organization membership is separate from region visibility

**Status:** Accepted  
**Date:** 2026-08-19  
**Implementation:** In progress behind `organizationGroups`

## Context

One job may involve Dallas and Georgia, several Georgia departments, BDC, and
individually pinned people. Those relationships answer different questions:
who participates, who can see the job, who is staffed on a pricing effort, and
who may take an action. Treating the relationships as one “team” field caused
the roundtable to read job Access as staffing and would make organization
filters accidentally grant or revoke access.

The shipped model already treats `jobs.region` as home metadata and uses
`job_region_visibility` plus person pins for access.

## Decision

Keep four concepts distinct:

1. **Organization membership** — additive job-to-group relationships with
   lead/partner and operations/preconstruction roles.
2. **Region/person visibility** — the existing access layer determining who
   can read a job and its rounds.
3. **Staffing** — assignments to a round and, when introduced, its stage.
4. **Permission** — actions authorized by the kernel and governing policy.

Adding a group membership does not implicitly grant every member visibility.
Any policy that derives visibility from membership must do so explicitly,
audibly, and through the visibility layer. Staffing never changes visibility
or permission.

`jobs.region` remains the home region, not an access-control shortcut.
`job_region_visibility` and person pins remain valid during additive group
backfill and fallback reads. The job UI labels access as “Who can see this”;
staffing moves to the round.

## Consequences

- Dallas/Georgia and Georgia-slice participation can remain one job while
  preserving current regional access boundaries.
- IJV can describe participating groups and a lead without becoming a
  yes/no field or a permission grant.
- Filters over organization groups and authorization tests over visibility
  require separate fixtures.
- Existing jobs remain readable during migration even before group membership
  has been fully backfilled.
