# Database setup

## Quick start (new database)

```sql
CREATE DATABASE nhia_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Configure `.env`, then run **one command**:

```bash
npm run db:setup
```

That is it. It creates all tables and loads everything you need to use the app.

---

## Commands (only 4)

| Command | When to use |
|---------|-------------|
| `npm run db:setup` | **New database** — same as `db:seed-all` |
| `npm run db:seed-all` | **Sync + migrations + seeds** — update schema and load all data |
| `npm run db:sync` | **Schema only** — update tables to match models (no demo data) |
| `npm run db:seed` | **Incremental seeds** — idempotent migrations + insert missing reference/demo rows |
| `npm run db:fix-servicom-fks` | **Repair only** — clears bad state/zone IDs before sync on old data |

You do **not** need individual `db:migrate-*` scripts on a fresh database — use `db:seed-all`.

---

## What `db:seed-all` runs

Runs in this order. Each seed step **always runs** and uses `findOrCreate` (or equivalent) so only **missing** rows are inserted — existing data is never overwritten.

| Phase | Script | What it does |
|-------|--------|--------------|
| Migrate | `syncDb.js` | All tables + default admin user |
| Migrate | `migrateRoles.js` | Role definitions |
| Migrate | `legacy/addComplianceManagement.js` | Compliance report tables |
| Migrate | `legacy/migrateStateOfficeReports.js` | State Office report tables |
| Migrate | `legacy/migrateCompliancePrivileges.js` | SQA Compliance Management access |
| Migrate | `legacy/migrateSocZonesPrivileges.js` | SOC/Zones privilege updates |
| Seed | `seedZonesStates.js` | 6 zones + 37 states |
| Seed | `seedDepartmentsUnits.js` | Departments & units |
| Seed | `seedUsers.js` | Demo coordinators & officers |
| Seed | `seedServicomIndicators.js` | SERVICOM assessment indicators |
| Seed | `seedServicomData.js` | Sample facilities, visits, complaints |
| Seed | `seedStateOfficeData.js` | Sample state office monthly reports |
| Seed | `seedAccreditedProviders.js` | **HMO + HCF** — synced from [nhia.gov.ng](https://www.nhia.gov.ng) (~94 HMO, ~6500+ HCP) |

---

## Default logins

| User | Staff ID | Password | Role |
|------|----------|----------|------|
| System admin | `ADMIN001` | `Admin@1234` | admin |
| Demo users | see seed output | `Nhia@2025` | various |

---

## Existing / production database

If the database already has data:

```bash
npm run db:sync
```

If sync fails with a foreign-key error on SERVICOM tables:

```bash
npm run db:fix-servicom-fks
npm run db:sync
```

To add any missing demo/reference data (and idempotent privilege/table migrations) without a full schema sync:

```bash
npm run db:seed
```

Safe to run on production-like databases — only rows that are not already present are inserted.

---

## Legacy migrations

Files in `src/scripts/legacy/` are **one-time upgrades** for databases created before models were updated. They are **not** needed for new databases — `db:sync` handles everything via Sequelize models.

Do **not** import `sql/seed_data.sql` on a database that already ran JS seeds — it truncates zones/states and creates duplicate rows.

---

## Accredited HMO & HCF (nhia.gov.ng)

`db:seed` and `db:seed-all` pull the official NHIA lists:

- HMO: https://www.nhia.gov.ng/hmo/
- HCP: https://www.nhia.gov.ng/hcps/

Requires outbound HTTPS (~30 seconds). Rows are upserted by `(provider_type, provider_code)`.

To refresh only providers (force re-download):

```bash
npm run db:sync-accredited-providers -- --force
```

Offline / skip network fetch during seed:

```bash
set NHIA_SKIP_PROVIDER_SYNC=1
npm run db:seed
```
