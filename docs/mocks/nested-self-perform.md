# Nested self-perform card (mock only)

This is the Phase 0 requested mock. It is **not** production schema and is not
wired to round save. Dual priced/proposed scalars remain the live fields until
the group approves a replacement.

## Card sketch

- One parent pricing effort keeps fee, estimate value, and outcome.
- Work-type rows are dynamic: generic type + optional specific type.
- Each row can hold dollars, optional hours, and inclusive/additional flags.
- Inclusive-versus-additional warnings stay on the mock, not in lock-gate math.
- Production/non-production hours stay off the first implementation.

```
Self-perform (nested mock)
┌─────────────────────────────────────────────────────────────┐
│ Concrete                                                    │
│   Specific: CIP walls          $1.2M   4,800 hrs   Additional│
│ Structural steel                                            │
│   Specific: —                  $800k   — hrs       Inclusive │
│ [Add work type]                                             │
│ Parent fee stays on this effort. Child fee is not added.    │
└─────────────────────────────────────────────────────────────┘
```

Do not add `self_perform_lines` tables until 12.2–12.4 are decided.
