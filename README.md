# NHIA Backend API

Node.js + Express + MySQL + Sequelize backend for the NHIA Annual Report system.

## Setup

```bash
cd nhia-backend
npm install
cp .env.example .env   # fill in your DB credentials
```

## Create the database

```sql
CREATE DATABASE nhia_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Sync tables

```bash
npm run db:sync
```

## Run (development)

```bash
npm run dev
```

Server starts on `http://localhost:3001`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/annual-reports` | List all reports |
| GET | `/api/annual-reports/:id` | Get by numeric id or reference_id |
| POST | `/api/annual-reports` | Create report |
| PUT | `/api/annual-reports/:id` | Update report |
| PATCH | `/api/annual-reports/:id/status` | Update status only |
| DELETE | `/api/annual-reports/:id` | Delete report |

### Query filters (GET list)
- `?state=Lagos`
- `?year=2025`
- `?status=submitted`

> `:id` accepts either the numeric primary key (`42`) or the reference ID (`NHIA-AR-2025-00042`)

### POST / PUT body shape

```json
{
  "general": {
    "year": "2025",
    "state": "Lagos",
    "staffNo": "45",
    "totalVehicles": "12",
    "totalHCF": "200",
    "totalAccreditedHCF2025": "180",
    "approvedBudget2025": "50000000",
    "totalAmountUtilized2025": "42000000"
  },
  "clinical": {
    "totalAccreditedCEmONC": "30",
    "totalCEmONCBeneficiaries": "1200",
    "totalAccreditedFFP": "25",
    "totalFFPBeneficiaries": "980"
  },
  "quarterly": {
    "gifshipEnrolments":     { "q1": "100", "q2": "120", "q3": "90", "q4": "110" },
    "premiumGIFSHIP":        { "q1": "0",   "q2": "0",   "q3": "0",  "q4": "0"   },
    "ops":                   { "q1": "0",   "q2": "0",   "q3": "0",  "q4": "0"   },
    "newEnrolmentsFSSHIP":   { "q1": "0",   "q2": "0",   "q3": "0",  "q4": "0"   },
    "extraDependants":       { "q1": "0",   "q2": "0",   "q3": "0",  "q4": "0"   },
    "premiumExtraDependant": { "q1": "0",   "q2": "0",   "q3": "0",  "q4": "0"   },
    "additionalDependants":  { "q1": "0",   "q2": "0",   "q3": "0",  "q4": "0"   },
    "changeOfProvider":      { "q1": "0",   "q2": "0",   "q3": "0",  "q4": "0"   }
  },
  "submitted_by": "SO · Lagos"
}
```
# NHIA-URMS-BACKEND
