# Form — Enrolment Drives (APPROVED)

Status: **approved — single table, business-key PK (no auto-increment `id`, no lines table)**

## Purpose

State-office enrolment drive activity register. **One row = one drive activity.** Drive kinds are separated by `drive_type` (advocacy, community-sensitization, …).

## Table

### `enrolment_drive_reports`

| Column | Type | Notes |
|--------|------|--------|
| `reference_id` | VARCHAR(30) **PK** | e.g. `EDAC-2026-00001` (prefix by drive type) |
| `drive_type` | VARCHAR(40) | required — `advocacy`, `community-sensitization`, … |
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
| `planned_activities` | INT UNSIGNED | nullable (FE header) |
| `drive_code` | VARCHAR(20) | e.g. E-001 |
| `activity_date` | DATE | |
| `activity_category` | VARCHAR(120) | required |
| `specific_activity` | VARCHAR(255) | |
| `funding_option` | VARCHAR(80) | |
| `activity_budget` | DECIMAL(15,2) | |
| `approved_amount` | DECIMAL(15,2) | |
| `target_audience` | JSON | string array |
| `location_category` | VARCHAR(80) | |
| `location_name` | VARCHAR(150) | |
| `programs_supported` | JSON | string array |
| `activity_details` | TEXT | |
| `planned_target_audience` | INT UNSIGNED | |
| `target_audience_reached` | INT UNSIGNED | |
| `leads_generated` | INT UNSIGNED | |
| `new_enrolments` | INT UNSIGNED | |
| `supporting_documents` | JSON | `[{name, path}]` |
| `activity_status` | VARCHAR(30) | |
| `remarks` | TEXT | |
| `quarter` | TINYINT UNSIGNED | derived from month |
| `created_by_user_id` | INT UNSIGNED FK → `users.id` | nullable, ON DELETE SET NULL |
| `created_at` / `updated_at` | DATETIME | |

Index: `(drive_type, zonal_code, state_code, reporting_year, reporting_month)` (not unique).

## Relationships

```
zonal_offices 1──* enrolment_drive_reports
state_offices 1──* enrolment_drive_reports
departments 1──* enrolment_drive_reports (optional)
units 1──* enrolment_drive_reports (optional)
users 1──* enrolment_drive_reports (created_by)
```

**Discarded:** `enrolment_drive_report_lines`.

## API

```
/api/state-office/enrolment-drive-{drive_type}/reports
```

Controllers expose `id` as `reference_id` and a synthetic `lines: [activity…]` for frontend compatibility. File uploads append into `supporting_documents` on the same row.
