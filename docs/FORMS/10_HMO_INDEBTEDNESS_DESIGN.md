# Form — HMO Indebtedness (APPROVED)

Status: **approved — Collation + Recon write tables; Master + Facts are live VIEWs (no JSON, no auto-increment `id`)**

## Purpose

Enforcement HMO indebtedness pack: Collation (alleged CAP/FFS/PHI), Recon streams (PHI/FFS/Cap lifecycle), Master (wide UI), Facts (long analysis).

## Physical tables (4)

### `hmo_indebtedness_reports` + `hmo_indebtedness_lines`

Collation. Ref `HID-{year}-{#####}`. PK `reference_id`. Lines PK `(report_reference_id, sn)`.

### `hmo_recon_reports` + `hmo_recon_lines`

Recon with `stream_type` ENUM(`phi`,`ffs`,`cap`). Ref `HRP`/`HRF`/`HRC`-`{year}`-`{#####}`.

## Views (2, not writable)

- `hmo_indebtedness_master_v` — wide row per state/period/HMO/HCF (Template 3)
- `hmo_indebtedness_facts_v` — long row per stream + measure (analysis)

API Master compiled endpoint may assemble nested HMO groups from live tables (same join semantics as the master view).

## Discard

Legacy `state_office_hmo_indebtedness*`, `state_office_hmo_recon_*`, `state_office_hmo_master_*`.
