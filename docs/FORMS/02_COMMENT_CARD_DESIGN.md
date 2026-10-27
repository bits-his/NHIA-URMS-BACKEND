# Form — Citizens' Comment Card (APPROVED)

Status: **approved — implementing**

## Purpose

Transactional SERVICOM charter feedback (Citizens' Comment Card / Charter Performance). One header per citizen response; exactly five scored question lines (Q01–Q05). Not a monthly pack.

## Tables

### `servicom_comment_cards` (header)

| Column | Type | Notes |
|--------|------|--------|
| `reference_id` | VARCHAR(30) PK | system-generated e.g. `CCC-2026-00001` (no surrogate `id`) |
| `zonal_code` | VARCHAR(20) FK → `zonal_offices.zonal_code` | NOT NULL |
| `state_code` | VARCHAR(20) FK → `state_offices.code` | NOT NULL |
| `unit_code` | VARCHAR(20) FK → `units.unit_code` | nullable; default `SVC-STD` |
| `card_date` | DATE | NOT NULL |
| `respondent_name` | VARCHAR(150) | nullable |
| `organisation` | VARCHAR(200) | nullable |
| `total_score` | INT UNSIGNED | sum of line scores |
| `average_score` | DECIMAL(4,2) | mean of answered scores |
| `created_by_user_id` | INT UNSIGNED FK → `users.id` | nullable ON DELETE SET NULL |
| `created_at` / `updated_at` | DATETIME | |

Indexes: `(state_code, card_date)`, `(zonal_code, card_date)`.

App rule: selected state's `zonal_code` must match header `zonal_code`.

### `servicom_comment_card_responses` (lines)

| Column | Type | Notes |
|--------|------|--------|
| `reference_id` | VARCHAR(30) PK part | FK → `servicom_comment_cards.reference_id` ON DELETE CASCADE |
| `question_id` | VARCHAR(10) PK part | `Q01`…`Q05` |
| `section` | VARCHAR(40) | Reception / Front Desk Staff / Overall |
| `question_text` | VARCHAR(500) | snapshot at save |
| `scale_max` | TINYINT UNSIGNED | 4 or 5 |
| `response_value` | TINYINT UNSIGNED | 1…`scale_max` |
| `score` | TINYINT UNSIGNED | = `response_value` |

**PRIMARY KEY** `(reference_id, question_id)`.

## Relationships

```
zonal_offices 1──* servicom_comment_cards
state_offices 1──* servicom_comment_cards
units         1──* servicom_comment_cards
users         1──* servicom_comment_cards
servicom_comment_cards 1──* servicom_comment_card_responses
```

## API

```
/api/servicom/comment-cards
```

Other SERVICOM routes remain 503 until their designs are approved.

## Workflow

Create / update only (no draft → submit → approve).
