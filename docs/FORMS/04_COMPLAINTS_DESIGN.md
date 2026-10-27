# Form — Complaints Management (APPROVED)

Status: **approved — implementing**

## Purpose

Transactional SERVICOM Complaints Management register. One header per complaint; flat comment thread. Not a monthly pack.

## Tables

### `servicom_complaints` (header)

| Column | Type | Notes |
|--------|------|--------|
| `complaint_number` | VARCHAR(60) PK | system `ENF/{HCF\|HMO\|ENR}/{STATE}/{MON YY}/{seq}` (no surrogate `id`) |
| `zonal_code` | VARCHAR(20) FK → `zonal_offices.zonal_code` | NOT NULL |
| `state_code` | VARCHAR(20) FK → `state_offices.code` | NOT NULL |
| `unit_code` | VARCHAR(20) FK → `units.unit_code` | nullable; default `SVC-CMP` |
| `reporting_month` / `reporting_year` | TINYINT / SMALLINT | from date_received |
| `entry_date` | DATE | nullable |
| `complaint_date` | DATE | NOT NULL (from date_received) |
| Party / offence / priority / transmission | VARCHAR… | register fields |
| `complainant_hmo_code` / `respondent_hmo_code` | VARCHAR(40) | FK → `hmo_providers.hmo_code` ON DELETE SET NULL |
| `complainant_hcf_code` / `respondent_hcf_code` | VARCHAR(100) | string only (no HCF FK this pack) |
| `*_hcf_name` | VARCHAR(200) | denormalized labels |
| Investigation / escalation / resolution | mixed | status default `New/Acknowledged` |
| `actions_taken` | JSON | array of investigation actions |
| `created_by_user_id` | INT UNSIGNED FK → `users.id` | nullable ON DELETE SET NULL |
| `created_at` / `updated_at` | DATETIME | |

Indexes: `(state_code, date_received)`, `(zonal_code, date_received)`, `(status)`, `(priority_rating)`.

App rule: selected state's `zonal_code` must match header `zonal_code`.

### `servicom_complaint_comments` (flat thread)

| Column | Type | Notes |
|--------|------|--------|
| `complaint_number` | VARCHAR(60) PK part | FK → header ON DELETE CASCADE |
| `comment_seq` | SMALLINT UNSIGNED PK part | 1…n per complaint |
| `body` | TEXT | NOT NULL |
| `created_by_user_id` | INT UNSIGNED FK → `users.id` | nullable ON DELETE SET NULL |
| `created_at` / `updated_at` | DATETIME | |

**PRIMARY KEY** `(complaint_number, comment_seq)`.

## Relationships

```
zonal_offices 1──* servicom_complaints
state_offices 1──* servicom_complaints
units         1──* servicom_complaints
users         1──* servicom_complaints
hmo_providers 1──* servicom_complaints (complainant / respondent hmo_code)
servicom_complaints 1──* servicom_complaint_comments
```

## API

```
/api/servicom/complaints
```

Get/update/comments keyed by URL-encoded `complaint_number`. Other unapproved SERVICOM routes remain 503.

## Workflow

Create / update / comments (register status lifecycle). No draft → submit → approve.
