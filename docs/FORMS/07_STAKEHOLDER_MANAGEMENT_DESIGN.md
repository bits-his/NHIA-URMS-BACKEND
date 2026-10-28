# Form — Stakeholder Management (APPROVED)

Status: **approved — flat engagement rows + outcomes child; shared `form_documents` (no JSON bags, no auto-increment `id`)**

## Purpose

State-office stakeholder engagement register. **One row = one engagement.** Outcomes are repeating items. Files/evidence live in the shared documents table.

## Tables

### `stakeholder_reports`

| Column | Type | Notes |
|--------|------|--------|
| `reference_id` | VARCHAR(30) **PK** | `STK-{year}-{#####}` |
| `activity_module` | VARCHAR(60) | e.g. `engagement-coordination` |
| `zonal_code` / `state_code` | VARCHAR(20) FK | NOT NULL, RESTRICT |
| `department_code` / `unit_code` | VARCHAR(20) FK | nullable, SET NULL |
| period + workflow | | year, month, quarter, planned_activities, submission_*, status ENUM (provider-style), coordinator_*, created_by_user_id |
| engagement scalars | | engagement_code, activity_date, engagement_category, … |
| multi-selects | TEXT | pipe-delimited: `stakeholder_categories`, `target_audience_reached`, `programs_supported`, `supporting_evidence_types` |
| follow-up scalars | | flattened from former JSON |
| `activity_status` / `remarks` / `expected_output` | | |
| timestamps | | |

### `stakeholder_outcomes`

| Column | Type | Notes |
|--------|------|--------|
| `report_reference_id` | VARCHAR(30) FK → parent | ON DELETE CASCADE |
| `sn` | SMALLINT UNSIGNED | |
| `outcome_category` | VARCHAR(160) | |
| `specific_outcome` | VARCHAR(200) | |

**PK:** `(report_reference_id, sn)`

### Shared `form_documents` (all packs)

| Column | Type | Notes |
|--------|------|--------|
| `form_key` | VARCHAR(40) | e.g. `stakeholder`, `beneficiary-management` |
| `report_reference_id` | VARCHAR(30) | parent business key |
| `sn` | SMALLINT UNSIGNED | |
| `doc_kind` | ENUM(`supporting`,`evidence`,`report`) | |
| `name` / `path` / `mime` | | |

**PK:** `(form_key, report_reference_id, sn)`

Replaces `beneficiary_management_documents`.

## API

```
/api/state-office/stakeholder/reports
```

`id` = `reference_id`; synthetic `lines: [row…]` with outcomes + documents arrays for FE.
