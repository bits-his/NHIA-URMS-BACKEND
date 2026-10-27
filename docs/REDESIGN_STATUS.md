# Database redesign — implementation status

Branch: `feature/database-reengineering`

## Current mode: form-by-form rebuild

`nhia_db` now has **15 core tables only** (login + reference data).  
All legacy form/report tables were purged. App boots in **rebuild mode** — does not sync old tables; legacy APIs return 503.

See `FORM_BY_FORM_REBUILD.md` and `FORMS/01_ENROLMENT_DESIGN.md`.

### Remaining tables

users, roles, zonal_offices, state_offices, departments, units,  
hmo_providers, hcf_facilities, nhia_accredited_providers,  
lookup_domains, lookup_values, modules, features, user_privileges,  
app_notifications

### Commands

```bash
npm run db:sync:active              # sync allowlist only
npm run db:purge:legacy             # dry-run
npm run db:purge:legacy:confirm     # drop non-allowlisted
```

### Next

Approve **Form 1 — Enrolment** design → implement tables + routes.
