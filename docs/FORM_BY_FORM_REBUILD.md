# Form-by-form database rebuild

## Rules

1. **Keep forever (core):** login + reference/master data only  
   `users`, `roles`, zones/states, departments/units, HMO/HCF masters, lookups, privileges, notifications.
2. **Form tables:** created **only after you approve** that form’s design.
3. **App sync:** never runs `sequelize.sync` on the old 100+ models.  
   Only `npm run db:sync:active` / boot using `src/models/active.js`.
4. **Routes:** only auth, admin/org, lookups, and **approved** form routes are mounted.

## Commands

```bash
# See what would be dropped (safe)
node src/scripts/redesign/purgeNonCoreTables.js

# Drop everything except core (+ approved forms)
node src/scripts/redesign/purgeNonCoreTables.js --confirm

# Sync only allowlisted tables
npm run db:sync:active
```

## How we add the next form

1. You pick a form (e.g. Enrolment).
2. I propose **table DDL** (header + lines, PKs, FKs, uniques).
3. You **approve** (or request changes).
4. I add models, put the form key in `APPROVED_FORMS`, wire routes, sync.
5. Repeat for the next form.

## Config file

`src/config/activeSchema.js` — single source of truth for what exists in the DB.

## First form awaiting approval

See **Form 1 — Enrolment** proposal at the bottom of this chat / in  
`docs/FORMS/01_ENROLMENT_DESIGN.md`.
