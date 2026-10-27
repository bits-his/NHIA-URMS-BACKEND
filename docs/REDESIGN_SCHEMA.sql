-- =============================================================================
-- NHIA URMS — Target schema (operational + analytics)
-- Charset: utf8mb4 | Engine: InnoDB
-- Does NOT replace the live app yet — run in a side database / migration track.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- 0. Optional clean slate (only on a dedicated redesign DB)
-- ---------------------------------------------------------------------------
-- DROP DATABASE IF EXISTS nhia_urms_v2;
-- CREATE DATABASE nhia_urms_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE nhia_urms_v2;

-- =============================================================================
-- LAYER A — ORGANIZATION & ACCESS
-- =============================================================================

CREATE TABLE zones (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20)  NOT NULL,
  name          VARCHAR(120) NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_zones_code (code)
) ENGINE=InnoDB;

CREATE TABLE states (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  zone_id       INT UNSIGNED NOT NULL,
  code          VARCHAR(20)  NOT NULL,
  name          VARCHAR(120) NOT NULL,
  is_hq         TINYINT(1)   NOT NULL DEFAULT 0,
  is_zonal_office TINYINT(1) NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_states_code (code),
  KEY idx_states_zone (zone_id),
  CONSTRAINT fk_states_zone FOREIGN KEY (zone_id) REFERENCES zones(id)
) ENGINE=InnoDB;

CREATE TABLE departments (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(30)  NOT NULL,
  name          VARCHAR(150) NOT NULL,
  location_scope ENUM('hq','state','both') NOT NULL DEFAULT 'hq',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_departments_code (code)
) ENGINE=InnoDB;

CREATE TABLE units (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_id INT UNSIGNED NOT NULL,
  code          VARCHAR(30)  NOT NULL,
  name          VARCHAR(150) NOT NULL,
  location_role VARCHAR(60)  NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_units_code (code),
  KEY idx_units_dept (department_id),
  CONSTRAINT fk_units_dept FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

CREATE TABLE roles (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  key_name           VARCHAR(50)  NOT NULL,          -- was roles.key
  label              VARCHAR(100) NOT NULL,
  staff_id_prefix    VARCHAR(10)  NOT NULL DEFAULT 'USR',
  report_scope       ENUM('national','zonal','state','none') NOT NULL DEFAULT 'none',
  can_create_monthly TINYINT(1)   NOT NULL DEFAULT 0,
  can_review_monthly TINYINT(1)   NOT NULL DEFAULT 0,
  is_system          TINYINT(1)   NOT NULL DEFAULT 0,
  is_active          TINYINT(1)   NOT NULL DEFAULT 1,
  description        TEXT NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_roles_key (key_name)
) ENGINE=InnoDB;

CREATE TABLE users (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_id       VARCHAR(30)  NOT NULL,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(150) NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role_id        INT UNSIGNED NOT NULL,              -- real FK (not string soft-link)
  zone_id        INT UNSIGNED NULL,
  state_id       INT UNSIGNED NULL,
  department_id  INT UNSIGNED NULL,
  unit_id        INT UNSIGNED NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_staff (staff_id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  KEY idx_users_geo (zone_id, state_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_users_zone FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL,
  CONSTRAINT fk_users_state FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE SET NULL,
  CONSTRAINT fk_users_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_users_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Replaces users.functionalities JSON
CREATE TABLE modules (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  key_name   VARCHAR(60)  NOT NULL,                  -- e.g. zonal, soc_zones, sdo, settings
  label      VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_modules_key (key_name)
) ENGINE=InnoDB;

CREATE TABLE features (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  module_id  INT UNSIGNED NOT NULL,
  key_name   VARCHAR(80)  NOT NULL,                  -- e.g. enrolment, migration
  label      VARCHAR(150) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_features_module_key (module_id, key_name),
  CONSTRAINT fk_features_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE user_privileges (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  feature_id INT UNSIGNED NOT NULL,
  can_view   TINYINT(1) NOT NULL DEFAULT 1,
  can_create TINYINT(1) NOT NULL DEFAULT 0,
  can_review TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_feature (user_id, feature_id),
  CONSTRAINT fk_up_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_up_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- LAYER B — DYNAMIC LOOKUPS (dropdowns, enums that grow)
-- =============================================================================

CREATE TABLE lookup_domains (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  key_name    VARCHAR(80)  NOT NULL,                 -- enrolment_channel, activity_status
  label       VARCHAR(150) NOT NULL,
  description TEXT NULL,
  is_system   TINYINT(1) NOT NULL DEFAULT 0,         -- system domains locked from delete
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lookup_domains_key (key_name)
) ENGINE=InnoDB;

CREATE TABLE lookup_values (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  domain_id   INT UNSIGNED NOT NULL,
  code        VARCHAR(80)  NOT NULL,
  label       VARCHAR(200) NOT NULL,
  parent_id   INT UNSIGNED NULL,                     -- cascading dropdowns
  sort_order  INT NOT NULL DEFAULT 0,
  meta_json   JSON NULL,                             -- extra attrs (color, weight…)
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lookup_code (domain_id, code),
  KEY idx_lookup_parent (parent_id),
  CONSTRAINT fk_lookup_domain FOREIGN KEY (domain_id) REFERENCES lookup_domains(id) ON DELETE CASCADE,
  CONSTRAINT fk_lookup_parent FOREIGN KEY (parent_id) REFERENCES lookup_values(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- LAYER C — FORM ENGINE (replaces dozens of *_reports tables)
-- =============================================================================

CREATE TABLE form_templates (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  feature_id    INT UNSIGNED NOT NULL,               -- links privilege + nav
  key_name      VARCHAR(80)  NOT NULL,               -- enrolment, migration
  name          VARCHAR(150) NOT NULL,
  description   TEXT NULL,
  period_type   ENUM('none','week','month','quarter','year') NOT NULL DEFAULT 'month',
  workflow_key  VARCHAR(60)  NOT NULL DEFAULT 'so_simple',
  allow_lines   TINYINT(1)   NOT NULL DEFAULT 1,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_form_templates_key (key_name),
  CONSTRAINT fk_form_templates_feature FOREIGN KEY (feature_id) REFERENCES features(id)
) ENGINE=InnoDB;

-- Immutable versions so historical submissions stay valid when fields change
CREATE TABLE form_template_versions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id   INT UNSIGNED NOT NULL,
  version_no    INT UNSIGNED NOT NULL,
  schema_json   JSON NULL,                           -- optional full snapshot
  published_at  DATETIME NULL,
  published_by  INT UNSIGNED NULL,
  is_current    TINYINT(1) NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_template_version (template_id, version_no),
  CONSTRAINT fk_ftv_template FOREIGN KEY (template_id) REFERENCES form_templates(id) ON DELETE CASCADE,
  CONSTRAINT fk_ftv_publisher FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE form_sections (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  version_id    INT UNSIGNED NOT NULL,
  key_name      VARCHAR(80)  NOT NULL,
  title         VARCHAR(150) NOT NULL,
  is_repeating  TINYINT(1)   NOT NULL DEFAULT 0,     -- line-item section
  sort_order    INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_section_key (version_id, key_name),
  CONSTRAINT fk_sections_version FOREIGN KEY (version_id) REFERENCES form_template_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE form_fields (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  section_id        INT UNSIGNED NOT NULL,
  key_name          VARCHAR(80)  NOT NULL,           -- enrolment_count, channel
  label             VARCHAR(200) NOT NULL,
  data_type         ENUM(
                      'text','textarea','integer','decimal','date','boolean',
                      'lookup','multi_lookup','json','file'
                    ) NOT NULL,
  lookup_domain_id  INT UNSIGNED NULL,
  is_required       TINYINT(1) NOT NULL DEFAULT 0,
  is_metric         TINYINT(1) NOT NULL DEFAULT 0,   -- publish to fact table when true
  metric_key        VARCHAR(80) NULL,                -- maps to dim_metric.metric_key
  validation_json   JSON NULL,                       -- min/max/regex/etc.
  ui_json           JSON NULL,                       -- placeholder, width, help
  sort_order        INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_field_key (section_id, key_name),
  KEY idx_fields_metric (is_metric, metric_key),
  CONSTRAINT fk_fields_section FOREIGN KEY (section_id) REFERENCES form_sections(id) ON DELETE CASCADE,
  CONSTRAINT fk_fields_lookup FOREIGN KEY (lookup_domain_id) REFERENCES lookup_domains(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE form_submissions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id     INT UNSIGNED NOT NULL,
  version_id      INT UNSIGNED NOT NULL,
  reference_id    VARCHAR(40)  NOT NULL,
  zone_id         INT UNSIGNED NOT NULL,
  state_id        INT UNSIGNED NOT NULL,
  period_year     SMALLINT UNSIGNED NULL,
  period_month    TINYINT UNSIGNED NULL,             -- 1-12
  period_week     TINYINT UNSIGNED NULL,
  period_quarter  TINYINT UNSIGNED NULL,             -- 1-4
  status          VARCHAR(40)  NOT NULL DEFAULT 'draft',
  submitted_by    INT UNSIGNED NULL,
  submitted_at    DATETIME NULL,
  created_by      INT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,                     -- soft delete
  UNIQUE KEY uq_submissions_ref (reference_id),
  -- one pack per geo+period per form (NULL-safe via generated period key in app,
  -- or enforce in app for week/quarter variants)
  UNIQUE KEY uq_submission_period (
    template_id, zone_id, state_id, period_year, period_month, period_week, period_quarter
  ),
  KEY idx_submissions_status (status),
  KEY idx_submissions_geo_period (zone_id, state_id, period_year, period_month),
  CONSTRAINT fk_sub_template FOREIGN KEY (template_id) REFERENCES form_templates(id),
  CONSTRAINT fk_sub_version FOREIGN KEY (version_id) REFERENCES form_template_versions(id),
  CONSTRAINT fk_sub_zone FOREIGN KEY (zone_id) REFERENCES zones(id),
  CONSTRAINT fk_sub_state FOREIGN KEY (state_id) REFERENCES states(id),
  CONSTRAINT fk_sub_submitter FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_sub_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Header-level (non-repeating) answers
CREATE TABLE form_answers (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id    INT UNSIGNED NOT NULL,
  field_id         INT UNSIGNED NOT NULL,
  value_text       TEXT NULL,
  value_number     DECIMAL(18,4) NULL,
  value_date       DATE NULL,
  value_bool       TINYINT(1) NULL,
  value_json       JSON NULL,
  lookup_value_id  INT UNSIGNED NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_answer (submission_id, field_id),
  KEY idx_answers_number (field_id, value_number),
  CONSTRAINT fk_ans_sub FOREIGN KEY (submission_id) REFERENCES form_submissions(id) ON DELETE CASCADE,
  CONSTRAINT fk_ans_field FOREIGN KEY (field_id) REFERENCES form_fields(id),
  CONSTRAINT fk_ans_lookup FOREIGN KEY (lookup_value_id) REFERENCES lookup_values(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Repeating line groups (replaces *_report_lines)
CREATE TABLE form_line_groups (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id  INT UNSIGNED NOT NULL,
  section_id     INT UNSIGNED NOT NULL,
  line_index     INT UNSIGNED NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_line_group (submission_id, section_id, line_index),
  CONSTRAINT fk_lg_sub FOREIGN KEY (submission_id) REFERENCES form_submissions(id) ON DELETE CASCADE,
  CONSTRAINT fk_lg_section FOREIGN KEY (section_id) REFERENCES form_sections(id)
) ENGINE=InnoDB;

CREATE TABLE form_line_answers (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  line_group_id    INT UNSIGNED NOT NULL,
  field_id         INT UNSIGNED NOT NULL,
  value_text       TEXT NULL,
  value_number     DECIMAL(18,4) NULL,
  value_date       DATE NULL,
  value_bool       TINYINT(1) NULL,
  value_json       JSON NULL,
  lookup_value_id  INT UNSIGNED NULL,
  UNIQUE KEY uq_line_answer (line_group_id, field_id),
  KEY idx_line_answers_number (field_id, value_number),
  CONSTRAINT fk_la_group FOREIGN KEY (line_group_id) REFERENCES form_line_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_la_field FOREIGN KEY (field_id) REFERENCES form_fields(id),
  CONSTRAINT fk_la_lookup FOREIGN KEY (lookup_value_id) REFERENCES lookup_values(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE form_attachments (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id  INT UNSIGNED NOT NULL,
  field_id       INT UNSIGNED NULL,
  line_group_id  INT UNSIGNED NULL,
  file_path      VARCHAR(500) NOT NULL,
  original_name  VARCHAR(255) NULL,
  mime_type      VARCHAR(120) NULL,
  size_bytes     INT UNSIGNED NULL,
  uploaded_by    INT UNSIGNED NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_sub FOREIGN KEY (submission_id) REFERENCES form_submissions(id) ON DELETE CASCADE,
  CONSTRAINT fk_att_field FOREIGN KEY (field_id) REFERENCES form_fields(id) ON DELETE SET NULL,
  CONSTRAINT fk_att_line FOREIGN KEY (line_group_id) REFERENCES form_line_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_att_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- LAYER D — WORKFLOW (one engine for all forms)
-- =============================================================================

CREATE TABLE workflow_definitions (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  key_name   VARCHAR(60)  NOT NULL,                  -- so_simple, hq_multitier, provider
  name       VARCHAR(120) NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_workflow_key (key_name)
) ENGINE=InnoDB;

CREATE TABLE workflow_transitions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workflow_id     INT UNSIGNED NOT NULL,
  from_status     VARCHAR(40) NOT NULL,
  action          VARCHAR(40) NOT NULL,              -- submit, approve, return, reject
  to_status       VARCHAR(40) NOT NULL,
  required_flag   ENUM('create','review','admin','any') NOT NULL DEFAULT 'any',
  sort_order      INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_transition (workflow_id, from_status, action),
  CONSTRAINT fk_wt_workflow FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE submission_status_events (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id  INT UNSIGNED NOT NULL,
  from_status    VARCHAR(40) NULL,
  to_status      VARCHAR(40) NOT NULL,
  action         VARCHAR(40) NOT NULL,
  actor_user_id  INT UNSIGNED NULL,
  note           TEXT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sse_sub (submission_id, created_at),
  CONSTRAINT fk_sse_sub FOREIGN KEY (submission_id) REFERENCES form_submissions(id) ON DELETE CASCADE,
  CONSTRAINT fk_sse_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- LAYER E — ANALYTICS STAR SCHEMA (visualization / BI / dashboards)
-- =============================================================================

CREATE TABLE dim_date (
  date_key     INT NOT NULL PRIMARY KEY,             -- YYYYMMDD
  full_date    DATE NOT NULL,
  year_num     SMALLINT NOT NULL,
  quarter_num  TINYINT NOT NULL,
  month_num    TINYINT NOT NULL,
  week_num     TINYINT NULL,
  month_name   VARCHAR(20) NOT NULL,
  UNIQUE KEY uq_dim_date (full_date)
) ENGINE=InnoDB;

CREATE TABLE dim_geography (
  geo_key      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  zone_id      INT UNSIGNED NOT NULL,
  state_id     INT UNSIGNED NOT NULL,
  zone_code    VARCHAR(20) NOT NULL,
  zone_name    VARCHAR(120) NOT NULL,
  state_code   VARCHAR(20) NOT NULL,
  state_name   VARCHAR(120) NOT NULL,
  UNIQUE KEY uq_dim_geo (zone_id, state_id),
  CONSTRAINT fk_dim_geo_zone FOREIGN KEY (zone_id) REFERENCES zones(id),
  CONSTRAINT fk_dim_geo_state FOREIGN KEY (state_id) REFERENCES states(id)
) ENGINE=InnoDB;

CREATE TABLE dim_metric (
  metric_key   VARCHAR(80) PRIMARY KEY,
  label        VARCHAR(150) NOT NULL,
  category     VARCHAR(80) NULL,                     -- enrolment, finance, servicom
  unit         VARCHAR(40) NULL,                     -- count, naira, percent
  aggregation  ENUM('sum','avg','max','min','last') NOT NULL DEFAULT 'sum',
  is_active    TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE dim_form (
  form_key     VARCHAR(80) PRIMARY KEY,              -- enrolment
  module_key   VARCHAR(60) NOT NULL,
  label        VARCHAR(150) NOT NULL
) ENGINE=InnoDB;

-- Grain: one metric value for one submission (+ optional line) at a period/geo
CREATE TABLE fact_report_metrics (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date_key        INT NOT NULL,                      -- first day of period
  geo_key         INT UNSIGNED NOT NULL,
  form_key        VARCHAR(80) NOT NULL,
  metric_key      VARCHAR(80) NOT NULL,
  status          VARCHAR(40) NOT NULL,
  submission_id   INT UNSIGNED NOT NULL,
  line_group_id   INT UNSIGNED NULL,
  value_number    DECIMAL(18,4) NOT NULL DEFAULT 0,
  published_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_fact_slice (date_key, geo_key, metric_key, status),
  KEY idx_fact_form (form_key, date_key),
  KEY idx_fact_sub (submission_id),
  CONSTRAINT fk_fact_date FOREIGN KEY (date_key) REFERENCES dim_date(date_key),
  CONSTRAINT fk_fact_geo FOREIGN KEY (geo_key) REFERENCES dim_geography(geo_key),
  CONSTRAINT fk_fact_form FOREIGN KEY (form_key) REFERENCES dim_form(form_key),
  CONSTRAINT fk_fact_metric FOREIGN KEY (metric_key) REFERENCES dim_metric(metric_key),
  CONSTRAINT fk_fact_sub FOREIGN KEY (submission_id) REFERENCES form_submissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Optional dedicated facts for non-form domains later
CREATE TABLE fact_cases (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date_key        INT NOT NULL,
  geo_key         INT UNSIGNED NOT NULL,
  case_type       VARCHAR(60) NOT NULL,              -- complaint, visit, …
  priority        VARCHAR(40) NULL,
  status          VARCHAR(40) NOT NULL,
  opened_count    INT NOT NULL DEFAULT 0,
  closed_count    INT NOT NULL DEFAULT 0,
  sla_breached    INT NOT NULL DEFAULT 0,
  KEY idx_fact_cases (date_key, geo_key, case_type)
) ENGINE=InnoDB;

-- =============================================================================
-- LAYER F — NOTIFICATIONS (connected)
-- =============================================================================

CREATE TABLE app_notifications (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  title        VARCHAR(200) NOT NULL,
  body         TEXT NULL,
  type         VARCHAR(40) NULL,
  link         VARCHAR(300) NULL,
  entity_type  VARCHAR(60) NULL,                     -- form_submission, case
  entity_id    BIGINT UNSIGNED NULL,
  is_read      TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- SEED SKETCH — Enrolment pilot (run after org + roles exist)
-- =============================================================================
-- INSERT INTO modules (key_name, label) VALUES ('zonal', 'Zonal');
-- INSERT INTO features (module_id, key_name, label)
--   SELECT id, 'enrolment', 'Enrolment' FROM modules WHERE key_name='zonal';
-- INSERT INTO lookup_domains (key_name, label) VALUES
--   ('enrolment_channel', 'Enrolment Channel'),
--   ('enrolment_type', 'Enrolment Type'),
--   ('activity_status', 'Activity Status');
-- INSERT INTO lookup_values (domain_id, code, label, sort_order)
--   SELECT id, 'online', 'Online', 1 FROM lookup_domains WHERE key_name='enrolment_channel'
--   UNION ALL ...
-- INSERT INTO workflow_definitions (key_name, name) VALUES ('so_simple', 'State Office Simple');
-- INSERT INTO workflow_transitions (workflow_id, from_status, action, to_status, required_flag) VALUES
--   (1, 'draft', 'submit', 'submitted', 'create'),
--   (1, 'submitted', 'approve', 'approved', 'review'),
--   (1, 'submitted', 'return', 'draft', 'review');
-- INSERT INTO form_templates (feature_id, key_name, name, workflow_key) ...
-- INSERT INTO dim_metric (metric_key, label, category, unit) VALUES
--   ('enrolment_count', 'Enrolments', 'enrolment', 'count'),
--   ('enrollees_validated', 'Enrollees Validated', 'enrolment', 'count'),
--   ('activity_budget', 'Activity Budget', 'enrolment', 'naira'),
--   ('approved_amount', 'Approved Amount', 'enrolment', 'naira');
