# Form 1 — Enrolment Activity Reporting (APPROVED)

Status: **approved — single table, business-key PK (no auto-increment `id`, no lines table)**

## Purpose

State-office enrolment activity register. **One row = one activity report** (period + activity fields together).

## Table

### `enrolment_reports`

| Column | Type | Notes |
|--------|------|--------|
| `reference_id` | VARCHAR(30) **PK** | e.g. `ENR-2026-00001` |
| `zonal_code` | VARCHAR(20) FK → `zonal_offices.zonal_code` | NOT NULL, ON DELETE RESTRICT |
| `state_code` | VARCHAR(20) FK → `state_offices.code` | NOT NULL, ON DELETE RESTRICT |
| `department_code` | VARCHAR(20) FK → `departments.department_code` | nullable, ON DELETE SET NULL |
| `unit_code` | VARCHAR(20) FK → `units.unit_code` | nullable, ON DELETE SET NULL |
| `reporting_year` | SMALLINT UNSIGNED | NOT NULL |
| `reporting_month` | TINYINT UNSIGNED | 1–12 NOT NULL |
| `submission_date` | DATE | nullable |
| `submitted_by` | VARCHAR(100) | nullable |
| `status` | ENUM(`draft`,`submitted`,`approved`) | default `draft` |
| `coordinator_review_note` | TEXT | nullable |
| `coordinator_reviewed_by` | VARCHAR(100) | nullable |
| `coordinator_reviewed_at` | DATETIME | nullable |
| `category` | VARCHAR(100) | required activity type |
| `activity_code` | VARCHAR(20) | |
| `activity_date` | DATE | |
| `enrolment_channel` | VARCHAR(50) | FE constants for now |
| `enrolment_type` | VARCHAR(40) | |
| `program_code` | VARCHAR(20) | |
| `program_name` | VARCHAR(100) | |
| `enrolment_category` | VARCHAR(100) | |
| `beneficiary_category` | VARCHAR(80) | |
| `beneficiary_status` | VARCHAR(80) | |
| `funding_option` | VARCHAR(80) | |
| `supporting_evidence` | VARCHAR(120) | |
| `status_reason` | TEXT | |
| `activity_budget` | DECIMAL(14,2) | |
| `approved_amount` | DECIMAL(14,2) | |
| `enrolment_count` | INT UNSIGNED | default 0 |
| `enrollees_validated` | INT UNSIGNED | |
| `activity_status` | VARCHAR(40) | |
| `remarks` | TEXT | |
| `program_details` | JSON | flexible extras |
| `quarter` | TINYINT UNSIGNED | derived from month |
| `created_by_user_id` | INT UNSIGNED FK → `users.id` | nullable, ON DELETE SET NULL |
| `created_at` / `updated_at` | DATETIME | |

Index on `(zonal_code, state_code, reporting_year, reporting_month)` for listing (not unique — multiple activities per period allowed).

## Relationships

```
zonal_offices 1──* enrolment_reports
state_offices 1──* enrolment_reports
departments 1──* enrolment_reports (optional)
units 1──* enrolment_reports (optional)
users 1──* enrolment_reports (created_by)
```

**Discarded:** `enrolment_report_lines` (activity fields live on the header row).

## API

```
/api/state-office/enrolment/reports
```

Controllers expose `id` as an alias of `reference_id`. For frontend compatibility, responses also include a synthetic `lines: [activity…]` array built from the same row.
