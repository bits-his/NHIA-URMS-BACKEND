# Redesign pivot — dedicated table per form

## What you asked for

Each form (Enrolment, Provider Accreditation, Medical Audits, …) gets **its own tables**.  
You open MySQL, open `provider_accreditation_reports`, and see that form’s data — **no** `WHERE form_key = …` on a shared dump.

## Architecture (revised)

```
SHARED (infrastructure only)
  zonal_offices, state_offices, users, roles, departments, units
  lookup_domains, lookup_values          ← dropdown catalogs
  report_status_events                   ← audit trail (entity_type + entity_id)
  dim_* / fact_*                         ← optional analytics publish

DEDICATED (one family per form)
  enrolment_reports + enrolment_report_lines
  provider_accreditation_reports + _lines
  provider_reaccreditation_reports + _lines
  provider_medical_audit_reports + _lines
  provider_qa_inspection_reports + _lines
  migration_reports + …                  (already separate)
  …
```

### Every dedicated header table has

| Column / constraint | Purpose |
|---------------------|---------|
| `id` PK | Surrogate key |
| `reference_id` UNIQUE | Business id (`ACC-2025-00001`) |
| `zone_id`, `state_id` FK | Real relationships to org |
| `reporting_year`, `reporting_month` | Period |
| UNIQUE `(zone_id, state_id, year, month)` | One pack per state/period |
| `status` | Workflow |
| `created_at` / `updated_at` | Audit |

### Every line table has

| Column / constraint | Purpose |
|---------------------|---------|
| `id` PK | |
| `report_id` FK → header `ON DELETE CASCADE` | |
| Domain columns | Typed, inspectable |

### What we are **not** using as the primary store

`form_submissions` / `form_answers` / `form_line_*` — shared EAV.  
Kept only as optional experiments; **business truth lives in dedicated tables.**

## Provider Management split

Old (bad for inspection):

```text
accreditation_reports  WHERE activity_module = 'medical-audits' | 'accreditation' | …
```

New:

| Form | Tables |
|------|--------|
| Accreditation | `provider_accreditation_reports` + `provider_accreditation_report_lines` |
| Reaccreditation | `provider_reaccreditation_reports` + `provider_reaccreditation_report_lines` |
| Medical Audits | `provider_medical_audit_reports` + `provider_medical_audit_report_lines` |
| QA Inspections | `provider_qa_inspection_reports` + `provider_qa_inspection_report_lines` |

API paths:

```text
/api/state-office/provider-accreditation/reports
/api/state-office/provider-reaccreditation/reports
/api/state-office/provider-medical-audits/reports
/api/state-office/provider-qa-inspections/reports
```

Legacy `/accreditation` still works and maps to **Accreditation** only (compat).
