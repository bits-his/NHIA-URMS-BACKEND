# URMS Redesign — Phased Plan

Companion to [`REDESIGN_SCHEMA.sql`](./REDESIGN_SCHEMA.sql).

**Goal:** stop growing sibling `*_reports` tables; move to **lookups + form engine + fact metrics**, starting with **Enrolment**, without a big-bang rewrite.

---

## Principles

1. **Additive first** — new tables live beside the current schema; old tables stay until dual-write is proven.
2. **One pilot form** — Enrolment only in Phase 1–2.
3. **Dashboards follow facts** — new charts read `fact_report_metrics`, not 40 report tables.
4. **Dropdowns are data** — no new ENUMs in MySQL for business lists.
5. **No new physical report tables** after Phase 1 kickoff for SOC monthly packs.

---

## Phase 0 — Foundation (1–2 weeks)

**Deliverables**

- Create side DB or prefixed tables from `REDESIGN_SCHEMA.sql` (Layers A–D minimum).
- Versioned migrations tool (prefer Sequelize CLI / Knex / Flyway) — **stop relying on `sync({ alter: true })` for this track**.
- Map current org rows → `zones`, `states`, `departments`, `units`, `roles`, `users` with **`role_id` FK**.
- Expand `users.functionalities` JSON → `modules` / `features` / `user_privileges` (keep JSON as read cache temporarily if needed).

**Exit criteria**

- All active users resolve via `role_id` + privilege rows.
- Admin can list privileges with SQL (`SELECT … FROM user_privileges JOIN features`).

**Non-goals**

- Do not delete `enrolment_reports` yet.
- Do not change frontend routing.

---

## Phase 1 — Lookups + Enrolment template (1–2 weeks)

**Lookups to seed (from current Enrolment lines)**

| Domain key | Example values (start from production DISTINCT) |
|------------|--------------------------------------------------|
| `enrolment_channel` | online, offline, … |
| `enrolment_type` | … |
| `enrolment_category` | … |
| `beneficiary_category` | … |
| `beneficiary_status` | … |
| `funding_option` | … |
| `activity_status` | … |
| `supporting_evidence` | … |

**Form definition**

- `form_templates.key_name = 'enrolment'`
- Version `1` with one repeating section `lines`
- Fields mirror `EnrolmentReportLine` columns; mark metrics:

| Field key | data_type | is_metric | metric_key |
|-----------|-----------|-----------|------------|
| enrolment_count | integer | yes | enrolment_count |
| enrollees_validated | integer | yes | enrollees_validated |
| activity_budget | decimal | yes | activity_budget |
| approved_amount | decimal | yes | approved_amount |
| enrolment_channel | lookup | no | — |
| activity_date | date | no | — |
| program_details | json | no | — |
| … | … | … | … |

**Workflow**

- `so_simple`: `draft → submit → submitted → approve → approved` (+ return).

**Admin APIs (new)**

```
GET  /api/lookups/:domainKey
POST /api/admin/lookups/:domainKey/values      (Settings privilege)
GET  /api/forms/enrolment/schema                 (current version)
```

**Exit criteria**

- Dropdown for Enrolment channel comes from `lookup_values`, not hardcoded FE arrays.
- Schema endpoint returns sections/fields for a dynamic or hybrid form renderer.

---

## Phase 2 — Dual-write Enrolment (2–3 weeks)

**Write path**

1. Existing `POST/PUT /api/state-office/enrolment/reports` keeps working.
2. On success, also upsert:
   - `form_submissions` (+ period unique key)
   - `form_line_groups` / `form_line_answers`
   - `submission_status_events` on status PATCH
3. On **approve**, run publisher → `fact_report_metrics`.

**Read path (optional toggle)**

- Feature flag `ENROLMENT_READ_V2=0|1`
- `0` = old tables (default)
- `1` = assemble response from form engine (parity tests required)

**Backfill job**

```text
For each enrolment_reports (+ lines):
  create submission (same reference_id)
  map lines → line_groups/answers
  if status=approved → publish facts
```

**Exit criteria**

- Spot-check: old list API ≡ v2 projection for last 12 months.
- Dashboard KPI “enrolments by state/month” can be served from `fact_report_metrics` only.
- Duplicate period inserts blocked by unique key.

**Parity tests**

- Create / update / submit / return / approve on both stores.
- File uploads (if any) → `form_attachments`.

---

## Phase 3 — Visualization cutover (1–2 weeks)

**Replace** state-office / SDO enrolment chart queries that union or hardcode enrolment tables with:

```sql
SELECT g.state_name, d.year_num, d.month_num, SUM(f.value_number) AS enrolments
FROM fact_report_metrics f
JOIN dim_geography g ON g.geo_key = f.geo_key
JOIN dim_date d ON d.date_key = f.date_key
WHERE f.metric_key = 'enrolment_count'
  AND f.status = 'approved'
  AND d.year_num = :year
GROUP BY g.state_name, d.year_num, d.month_num;
```

**FE**

- Enrolment dashboards / drill panels call `/api/analytics/metrics?...`
- Keep operational list UI on old or v2 read — independent of charts.

**Exit criteria**

- At least one national + one zonal enrolment visualization is fact-only.
- Perf acceptable with indexes on `fact_report_metrics`.

---

## Phase 4 — Second form + freeze old pattern (2–4 weeks)

Pick next form with same shape (recommended: **Migration** or **CEmONC**).

1. Define template + lookups + metrics (config only).
2. Dual-write + backfill.
3. Chart cutover for that module.

**Policy from this phase onward**

> New SOC monthly report types **must** use the form engine. No new `*_reports` / `*_report_lines` tables.

---

## Phase 5 — Deprecate legacy Enrolment tables (1 week + soak)

1. Set `ENROLMENT_READ_V2=1` in production.
2. Soak 2–4 weeks; monitor errors.
3. Make write path v2-primary; old tables become read-only archive.
4. Later: rename `enrolment_reports` → `z_archive_enrolment_reports` (or drop after backup).

Repeat per migrated module.

---

## Phase 6 — Platform expansion (ongoing)

| Expansion | How |
|-----------|-----|
| New dropdown value | Admin UI → `lookup_values` |
| New field on Enrolment | New `form_template_versions` (v2), migrate mapping; never rewrite history |
| New form | Template + fields + workflow bind + privilege feature row |
| New chart metric | `dim_metric` + mark `form_fields.is_metric` + publisher |
| Cascading dropdowns | `lookup_values.parent_id` |
| HQ multitier approve | New `workflow_definitions` / transitions — same submissions table |
| SERVICOM / store | Keep domain tables **or** fold visits/cases into `fact_cases`; still share geo/user/lookups |

Optional later: **Form Builder UI** (CRUD on templates/fields) and generic React form renderer driven by `/schema`.

---

## Suggested API surface (new)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/lookups/:domain` | Active dropdown values |
| GET | `/api/forms/:key/schema` | Current template version for UI |
| GET/POST | `/api/forms/:key/submissions` | List/create (geo-scoped) |
| GET/PUT | `/api/forms/:key/submissions/:id` | Detail/update answers+lines |
| PATCH | `/api/forms/:key/submissions/:id/transition` | `{ action, note }` via workflow |
| GET | `/api/analytics/metrics` | `metric_key`, year, zone, state filters |
| GET | `/api/analytics/drill` | Break down by geo/period/dimension |

Keep existing `/api/state-office/enrolment/*` as adapters during dual-write.

---

## Publisher algorithm (approve hook)

```
on transition → approved:
  delete existing fact_report_metrics where submission_id = ?
  for each answer/line_answer where field.is_metric:
    resolve dim_date from period (YYYYMM01)
    resolve dim_geography from zone_id/state_id
    insert fact_report_metrics (metric_key, value_number, status, …)
```

Re-run publisher on reopen→re-approve to keep facts consistent.

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Parity bugs (missed columns) | Contract tests: sample N reports old vs v2 JSON |
| Unique period conflicts from dirty legacy data | Clean duplicates before backfill; keep `reference_id` as migration key |
| FE still hardcodes options | Phase 1 forces lookup API for Enrolment selects |
| Team keeps adding `*_reports` tables | Code review gate + Phase 4 policy |
| Fact table bloat | Publish only `is_metric` fields; aggregate dashboards by SQL |

---

## Team sequencing (minimal)

| Role | Focus |
|------|--------|
| Backend | Schema migrations, dual-write, publisher, analytics API |
| Frontend | Lookup-driven selects, schema-driven fields (or thin adapter), fact charts |
| Admin / BA | Confirm Enrolment field list + dropdown canonical values |
| Ops | Side DB or migration window; backups before backfill |

---

## Immediate next implementation tickets

1. Add migration runner + apply Layer A–B tables on a **non-prod** DB.  
2. Script: sync zones/states/users → v2 with `role_id`.  
3. Seed Enrolment lookup domains from `SELECT DISTINCT` on `enrolment_report_lines`.  
4. Seed `form_templates` v1 for Enrolment.  
5. Dual-write adapter in `stateOfficeReport` Enrolment create/update/status.  
6. `GET /api/analytics/metrics` + wire one existing Enrolment chart.

When those six are done, the redesign is real — not just documentation.
