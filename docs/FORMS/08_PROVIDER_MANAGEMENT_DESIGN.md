# Form — Provider Management (APPROVED)

Status: **approved — single flat table + shared `form_documents` (no auto-increment `id`, no lines, no JSON bags)**

## Purpose

State-office Provider Management hub: accreditation, reaccreditation, QA inspections, medical audits. **One row = one activity.**

## Table

### `provider_management_reports`

| Column | Type | Notes |
|--------|------|--------|
| `reference_id` | VARCHAR(30) **PK** | `PACC`/`PREC`/`PQA`/`PMED`-`{year}`-`{#####}` |
| `form_type` | ENUM | `accreditation`, `reaccreditation`, `qa-inspections`, `medical-audits` |
| `engagement_code` | VARCHAR(20) | PM-0001…PM-0004 |
| `engagement_category` | VARCHAR(120) | |
| `zonal_code` / `state_code` | VARCHAR(20) FK | nullable on draft; state required for review |
| `department_code` / `unit_code` | VARCHAR(20) FK | nullable |
| period + workflow | | year, month, quarter, submission_*, status ENUM (provider-style), coordinator_*, created_by_user_id |
| activity scalars | | related_programme, bhcpf_activity_type, activity_date, facility counts, funding, budget, activity_status, remarks |
| metric columns | INT UNSIGNED | applications_received, forms_sold, completed_forms_returned, awaiting_*, phcs_awaiting_* |
| `supporting_evidence_types` | TEXT | pipe-delimited |
| timestamps | | |

Index: `(form_type, zonal_code, state_code, reporting_year, reporting_month)` (non-unique).

### Shared `form_documents`

`form_key` = `provider-management`. PK `(form_key, report_reference_id, sn)`.

## Discard

Eight `provider_*` header/line tables, legacy `accreditation_*`, JSON `activity_template`.

## API

```
/api/state-office/provider-management/reports
/api/state-office/provider-accreditation|…  (aliases by form_type)
```

`id` = `reference_id`; synthetic `lines: [row]` with `activity_template` rebuilt for FE compatibility.
