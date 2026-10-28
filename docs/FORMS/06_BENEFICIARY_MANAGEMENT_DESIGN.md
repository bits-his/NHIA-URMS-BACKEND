# Form — Beneficiary Management (APPROVED)

Status: **approved — parent + documents child; business-key PKs (no auto-increment `id`, no JSON bags)**

## Purpose

State-office Beneficiary Management hub: additional/extra dependant, HCP/HMO change, MDA HMO selection. **One row = one register activity.** Activity kinds separated by `activity_type`.

## Tables

### `beneficiary_management_reports`

| Column | Type | Notes |
|--------|------|--------|
| `reference_id` | VARCHAR(30) **PK** | `BMAD`/`BMEX`/`BMHC`/`BMHM`/`BMMS`-`{year}`-`{#####}` |
| `activity_type` | ENUM | `additional_dependant`, `extra_dependant`, `hcp_change`, `hmo_change`, `mda_hmo_selection` |
| `zonal_code` | VARCHAR(20) FK → `zonal_offices.zonal_code` | NOT NULL, ON DELETE RESTRICT |
| `state_code` | VARCHAR(20) FK → `state_offices.code` | NOT NULL, ON DELETE RESTRICT |
| `department_code` | VARCHAR(20) FK → `departments.department_code` | nullable, ON DELETE SET NULL |
| `unit_code` | VARCHAR(20) FK → `units.unit_code` | nullable, ON DELETE SET NULL |
| `enrolment_reference_id` | VARCHAR(30) FK → `enrolment_reports.reference_id` | nullable, ON DELETE SET NULL |
| `reporting_year` | SMALLINT UNSIGNED | NOT NULL |
| `reporting_month` | TINYINT UNSIGNED | 1–12 NOT NULL |
| `quarter` | TINYINT UNSIGNED | derived |
| `submission_date` | DATE | |
| `submitted_by` | VARCHAR(100) | |
| `status` | ENUM(`draft`,`submitted`,`approved`) | default `draft` |
| `endorsed` | BOOLEAN | default false — coordinator gate |
| `coordinator_review_note` | TEXT | |
| `coordinator_reviewed_by` | VARCHAR(100) | |
| `coordinator_reviewed_at` | DATETIME | |
| `created_by_user_id` | INT UNSIGNED FK → `users.id` | ON DELETE SET NULL |
| `enrollee_name` | VARCHAR(150) | |
| `nhia_number` | VARCHAR(50) | |
| `program_name` | VARCHAR(80) | |
| `mda` | VARCHAR(255) | |
| `request_date` | DATE | |
| `process_end_date` | DATE | |
| `activity_status` | VARCHAR(60) | |
| `remarks` | TEXT | |
| `request_kind` | ENUM(`additional`,`extra`) | dependant |
| `dependant_entity` | VARCHAR(40) | |
| `relationship_kind` | VARCHAR(40) | |
| `hcf` / `alternative_provider` | VARCHAR(255) | |
| identity columns | surname, first_name, middle_name, nin, blood_group, marital_status, state/lga origin & residence, phone_number, hmo_name | typed — not JSON |
| `change_entity_type` | ENUM(`hcp`,`hmo`) | provider change |
| `current_provider` / `new_provider` | VARCHAR(255) | |
| `reason_category` | VARCHAR(200) | |
| `reason_other` | TEXT | |
| `met_criteria` | VARCHAR(10) | |
| `record_date` | DATE | |
| `selection_date` | DATE | MDA |
| `former_hmo` / `selected_hmo` | VARCHAR(255) | |
| `reason_for_change` | TEXT | |
| `hmos_invited` / `hmos_attended` | INT UNSIGNED | |
| `hmos_in_attendance` | VARCHAR(500) | free-text string |
| `compliance_guideline` / `transparent_process` | VARCHAR(10) | |
| `created_at` / `updated_at` | DATETIME | |

Index: `(activity_type, zonal_code, state_code, reporting_year, reporting_month)` (not unique).

### `beneficiary_management_documents`

| Column | Type | Notes |
|--------|------|--------|
| `report_reference_id` | VARCHAR(30) FK → parent | ON DELETE CASCADE |
| `sn` | SMALLINT UNSIGNED | |
| `doc_kind` | ENUM(`supporting`,`evidence`,`report`) | |
| `name` | VARCHAR(255) | |
| `path` | VARCHAR(500) | |
| `mime` | VARCHAR(120) | |
| `created_at` / `updated_at` | DATETIME | |

**PK:** `(report_reference_id, sn)` — no auto-increment `id`.

## Relationships

```
zonal_offices 1──* beneficiary_management_reports
state_offices 1──* beneficiary_management_reports
departments 1──* beneficiary_management_reports (optional)
units 1──* beneficiary_management_reports (optional)
users 1──* beneficiary_management_reports (created_by)
enrolment_reports 1──* beneficiary_management_reports (optional principal link)
beneficiary_management_reports 1──* beneficiary_management_documents
```

**Discarded:** `extra_dependant_*`, `hcp_change_*`, `hmo_selection_*` (six tables), identity/docs JSON bags.

## API

```
/api/state-office/extra-dependant/reports   → additional_dependant | extra_dependant
/api/state-office/hcf-change/reports        → hcp_change | hmo_change
/api/state-office/hmo-selection/reports     → mda_hmo_selection
```

Controllers expose `id` as `reference_id`, synthetic `lines: [activity…]`, and document arrays for FE compatibility. Endorsement workflow: endorse/return → draft + `endorsed`; final_submit → approved only if endorsed.
