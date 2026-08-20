# Destini adapter contract

Live SQL vs next-day file remains a deferred transport choice. This app talks to Destini through one adapter:

- **Input:** a per-round export file (preview, then confirm).
- **Diff:** existing Destini import diff engine.
- **Provenance:** `source_provenance` + `integration_import_batches` with checksums.
- **Local wins:** identity and previously accepted local decisions are not overwritten.
- **Repeat imports:** idempotent against the same checksum.

Do not add a second live-SQL path until this contract is updated.
