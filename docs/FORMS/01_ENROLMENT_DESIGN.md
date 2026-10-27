# Form 1 — Enrolment (AWAITING YOUR APPROVAL)

Status: **proposed — do not implement until approved**

## Purpose

Monthly state-office enrolment activity register. One header per state per month; many activity lines.

## Tables

### `enrolment_reports` (header)

| Column | Type | Notes |
|--------|------|--------|
| `id` | INT UNSIGNED PK AI | |
| `reference_id` | VARCHAR(30) UNIQUE | e.g. `ENR-2026-00001` |
| `zone_id` | INT UNSIGNED FK → `zonal_offices.id` | NOT NULL |
| `state_id` | INT UNSIGNED FK → `state_offices.id` | NOT NULL |
| `reporting_year` | SMALLINT UNSIGNED | NOT NULL |
| `reporting_month` | TINYINT UNSIGNED | 1–12 NOT NULL |
| `submission_date` | DATE | nullable |
| `submitted_by` | VARCHAR(100) | nullable |
| `status` | ENUM(`draft`,`submitted`,`approved`) | default `draft` |
| `coordinator_review_note` | TEXT | nullable |
| `coordinator_reviewed_by` | VARCHAR(100) | nullable |
| `coordinator_reviewed_at` | DATETIME | nullable |
| `created_at` / `updated_at` | DATETIME | |

**UNIQUE** `(zone_id, state_id, reporting_year, reporting_month)` — one pack per state/month.

### `enrolment_report_lines` (lines)

| Column | Type | Notes |
|--------|------|--------|
| `id` | INT UNSIGNED PK AI | |
| `report_id` | INT UNSIGNED FK → `enrolment_reports.id` ON DELETE CASCADE | |
| `category` | VARCHAR(100) | required |
| `activity_code` | VARCHAR(20) | |
| `activity_date` | DATE | |
| `enrolment_channel` | VARCHAR(50) | prefer `lookup_values` later |
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

## Relationships

```
zonal_offices 1──* enrolment_reports
state_offices 1──* enrolment_reports
enrolment_reports 1──* enrolment_report_lines
```

## API (after approval)

```
/api/state-office/enrolment/reports
```

## Approve?

Reply with one of:

- **Approve Enrolment as proposed**
- **Approve with changes:** …
- **Skip — do Provider Accreditation first instead**
