# Legacy database migrations

These scripts were written to upgrade **existing** production databases when new tables or columns were added incrementally.

## Do you need them?

**No**, if you are setting up a **new** database. Use:

```bash
npm run db:setup
```

`db:sync` creates all current tables and columns from Sequelize models.

## When to use legacy scripts

Only when upgrading a very old database that cannot run `db:sync` cleanly, or when you need a specific one-time data migration (e.g. renaming user privileges in `migrateSocZonesPrivileges.js`).

Each file has a header comment describing what it does.
