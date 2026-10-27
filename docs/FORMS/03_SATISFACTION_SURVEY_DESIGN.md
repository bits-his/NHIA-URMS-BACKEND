# Form — HCF Customer Satisfaction Survey (APPROVED)

Status: **approved — implementing**

## Purpose

Transactional SERVICOM HCF Customer Satisfaction Survey. One header per facility visit survey; exactly seventeen yes/no question lines (Q01–Q17). Not a monthly pack.

## Tables

### `servicom_satisfaction_surveys` (header)

| Column | Type | Notes |
|--------|------|--------|
| `reference_id` | VARCHAR(30) PK | system-generated e.g. `SAT-2026-00001` (no surrogate `id`) |
| `zonal_code` | VARCHAR(20) FK → `zonal_offices.zonal_code` | NOT NULL |
| `state_code` | VARCHAR(20) FK → `state_offices.code` | NOT NULL |
| `unit_code` | VARCHAR(20) FK → `units.unit_code` | nullable; default `SVC-SAT` |
| `provider_name` | VARCHAR(200) | NOT NULL |
| `survey_date` | DATE | NOT NULL |
| `team` | JSON | array of officer name strings |
| `total_score` | INT UNSIGNED | sum of yes=1 scores |
| `max_score` | INT UNSIGNED | default 17 |
| `percentage_score` | DECIMAL(5,1) | `(total / max) × 100` |
| `created_by_user_id` | INT UNSIGNED FK → `users.id` | nullable ON DELETE SET NULL |
| `created_at` / `updated_at` | DATETIME | |

Indexes: `(state_code, survey_date)`, `(zonal_code, survey_date)`.

App rule: selected state's `zonal_code` must match header `zonal_code`.

### `servicom_satisfaction_survey_responses` (lines)

| Column | Type | Notes |
|--------|------|--------|
| `reference_id` | VARCHAR(30) PK part | FK → header ON DELETE CASCADE |
| `question_id` | VARCHAR(10) PK part | `Q01`…`Q17` |
| `category` | VARCHAR(40) | SERVICE DELIVERY / TIMELINESS / … |
| `question_text` | VARCHAR(500) | snapshot at save |
| `response_value` | VARCHAR(3) | `yes` or `no` |
| `score` | TINYINT UNSIGNED | 1 or 0 |

**PRIMARY KEY** `(reference_id, question_id)`.

## Relationships

```
zonal_offices 1──* servicom_satisfaction_surveys
state_offices 1──* servicom_satisfaction_surveys
units         1──* servicom_satisfaction_surveys
users         1──* servicom_satisfaction_surveys
servicom_satisfaction_surveys 1──* servicom_satisfaction_survey_responses
```

## API

```
/api/servicom/satisfaction-surveys
```

Get/update keyed by `reference_id`. Other unapproved SERVICOM routes remain 503.

## Workflow

Create / update only (no draft → submit → approve).
