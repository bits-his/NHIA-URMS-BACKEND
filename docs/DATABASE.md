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
| `npm run db:seed` | **Seeds only** — load reference + demo data after sync |
| `npm run db:fix-servicom-fks` | **Repair only** — clears bad state/zone IDs before sync on old data |

You do **not** need individual `db:migrate-*` scripts on a fresh database — use `db:seed-all`.

---

## What `db:seed-all` runs

Runs in this order (each step skips if data already exists):

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

To add demo data without touching schema:

```bash
npm run db:seed
```

---

## Legacy migrations

Files in `src/scripts/legacy/` are **one-time upgrades** for databases created before models were updated. They are **not** needed for new databases — `db:sync` handles everything via Sequelize models.

Do **not** import `sql/seed_data.sql` on a database that already ran JS seeds — it truncates zones/states and creates duplicate rows.

---

## Optional: accredited providers sync

Pulls HMO/HCP data from the external NHIA API (not part of normal setup):

```bash
node src/scripts/syncAccreditedProviders.js
```
