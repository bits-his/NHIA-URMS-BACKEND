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
| `npm run db:setup` | **New database** — sync schema + seed all data |
| `npm run db:sync` | **Existing database** — update tables to match models (no demo data) |
| `npm run db:seed` | **After sync** — load reference + demo data (skips what already exists) |
| `npm run db:fix-servicom-fks` | **Repair only** — clears bad state/zone IDs before sync on old data |

You do **not** need any `db:migrate-*` scripts on a fresh database.

---

## What `db:setup` loads

Runs in this order (each step skips if data already exists):

| Step | Script | What it adds |
|------|--------|--------------|
| 1 | `syncDb.js` | All tables + default admin user |
| 2 | `migrateRoles.js` | Role definitions |
| 3 | `seedZonesStates.js` | 6 zones + 37 states |
| 4 | `seedDepartmentsUnits.js` | Departments & units |
| 5 | `seedUsers.js` | Demo coordinators & officers |
| 6 | `seedServicomIndicators.js` | SERVICOM assessment indicators |
| 7 | `seedServicomData.js` | Sample facilities, visits, complaints |
| 8 | `seedStateOfficeData.js` | Sample state office monthly reports |

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
