# Form — Weekly Compliance Report (APPROVED)

Status: **approved — header + indicator child table (no auto-increment `id`, no JSON bag)**

## Purpose

Enforcement Weekly Compliance: compliance officers at HCFs. **One header row = one facility-week.** Sections B/C/D answers live in child rows.

## Tables

### `weekly_compliance_reports`

| Column | Type | Notes |
|--------|------|--------|
| `reference_id` | VARCHAR(30) **PK** | `WCR-{year}-{#####}` |
| `zonal_code` / `state_code` | VARCHAR(20) FK | required on submit |
| `department_code` / `unit_code` | VARCHAR(20) FK | nullable |
| period | | `reporting_week` (ISO), year, month, quarter |
| facility scalars | | facility_id, facility_name, nhia_code, facility_type(+other), facility_address |
| officer | | compliance_officer, designation_staff_id |
| workflow | | submission_*, status ENUM(`draft`,`submitted`,`approved`), created_by_user_id |
| timestamps | | |

Unique: `(state_code, reporting_week, nhia_code)`.

### `weekly_compliance_indicators`

PK `(report_reference_id, sn)`. Unique `(report_reference_id, indicator_key)`.

| Column | Notes |
|--------|--------|
| `section_key` | `service_delivery` \| `medicines` \| `provider_hmo` |
| `indicator_key` | e.g. `illegal_copayments` |
| `answer` | ENUM yes/no |
| `remarks` | TEXT |

## Discard

Legacy `state_office_weekly_compliance`, JSON `indicators`, integer `id` / `zone_id` / `state_id`.

## API

```
/api/state-office/weekly-compliance
/api/state-office/weekly-compliance/:id   (reference_id)
```

Response: `id` = `reference_id`; rebuild `indicators: { [key]: { answer, remarks } }` from child rows.
