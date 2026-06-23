-- =============================================================================
-- v_state_operational_annual
-- Read-only annual operational snapshot per state + year, built from
-- approved monthly departmental reports (Finance, Programmes, SQA).
--
-- Run once against nhia_db:
--   mysql -u root -p nhia_db < sql/views/v_state_operational_annual.sql
--
-- The API filters: WHERE reporting_year = ? [AND state_id = ?] [AND zone_id = ?]
-- =============================================================================

DROP VIEW IF EXISTS v_state_operational_annual;

CREATE VIEW v_state_operational_annual AS
WITH countable AS (
  SELECT 'submitted' AS s UNION ALL
  SELECT 'under_review' UNION ALL
  SELECT 'zonal_review' UNION ALL
  SELECT 'approved'
),
state_years AS (
  SELECT DISTINCT f.state_id, f.reporting_year
  FROM finance_monthly_reports f
  INNER JOIN countable c ON f.status = c.s
  UNION
  SELECT DISTINCT p.state_id, p.reporting_year
  FROM programmes_monthly_reports p
  INNER JOIN countable c ON p.status = c.s
  UNION
  SELECT DISTINCT s.state_id, s.reporting_year
  FROM sqa_monthly_reports s
  INNER JOIN countable c ON s.status = c.s
),
fin AS (
  SELECT * FROM finance_monthly_reports f
  INNER JOIN countable c ON f.status = c.s
),
prg AS (
  SELECT * FROM programmes_monthly_reports p
  INNER JOIN countable c ON p.status = c.s
),
sqa AS (
  SELECT * FROM sqa_monthly_reports s
  INNER JOIN countable c ON s.status = c.s
),
fin_fin AS (SELECT * FROM fin WHERE section = 'finance'),
fin_all AS (SELECT * FROM fin WHERE section IN ('finance', 'admin')),
prg_enr AS (SELECT * FROM prg WHERE section = 'enrolment'),
prg_out AS (SELECT * FROM prg WHERE section = 'outreach'),
sqa_main AS (SELECT * FROM sqa WHERE section = 'sqa'),
sqa_comp AS (SELECT * FROM sqa WHERE section = 'complaints')
SELECT
  sy.state_id,
  so.description AS state,
  so.zonal_id AS zone_id,
  zo.description AS zone,
  zo.zonal_code AS zone_code,
  sy.reporting_year,

  /* ── General (latest / sum rules match operationalData.service.js) ── */
  (
    SELECT fa.staff_no FROM fin_all fa
    WHERE fa.state_id = sy.state_id AND fa.reporting_year = sy.reporting_year AND fa.staff_no IS NOT NULL
    ORDER BY fa.reporting_month DESC LIMIT 1
  ) AS staff_no,
  (
    SELECT fa.total_vehicles FROM fin_all fa
    WHERE fa.state_id = sy.state_id AND fa.reporting_year = sy.reporting_year AND fa.total_vehicles IS NOT NULL
    ORDER BY fa.reporting_month DESC LIMIT 1
  ) AS total_vehicles,
  (
    SELECT sm.total_hcf_under_nhia FROM sqa_main sm
    WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.total_hcf_under_nhia IS NOT NULL
    ORDER BY sm.reporting_month DESC LIMIT 1
  ) AS total_hcf_under_nhia,
  (
    SELECT sm.total_accredited_hcf FROM sqa_main sm
    WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.total_accredited_hcf IS NOT NULL
    ORDER BY sm.reporting_month DESC LIMIT 1
  ) AS total_accredited_hcf,
  (
    SELECT ff.approved_budget FROM fin_fin ff
    WHERE ff.state_id = sy.state_id AND ff.reporting_year = sy.reporting_year AND ff.approved_budget IS NOT NULL
    ORDER BY ff.reporting_month DESC LIMIT 1
  ) AS approved_budget,
  COALESCE((
    SELECT SUM(ff.total_amount_utilized) FROM fin_fin ff
    WHERE ff.state_id = sy.state_id AND ff.reporting_year = sy.reporting_year
  ), 0) AS total_amount_utilized,

  /* ── CEmONC / FFP ── */
  (
    SELECT sm.cemonc_accredited_hcf FROM sqa_main sm
    WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.cemonc_accredited_hcf IS NOT NULL
    ORDER BY sm.reporting_month DESC LIMIT 1
  ) AS cemonc_accredited_hcf,
  (
    SELECT sm.cemonc_beneficiaries FROM sqa_main sm
    WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.cemonc_beneficiaries IS NOT NULL
    ORDER BY sm.reporting_month DESC LIMIT 1
  ) AS cemonc_beneficiaries,
  (
    SELECT sm.ffp_accredited_facilities FROM sqa_main sm
    WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.ffp_accredited_facilities IS NOT NULL
    ORDER BY sm.reporting_month DESC LIMIT 1
  ) AS ffp_accredited_facilities,
  (
    SELECT sm.ffp_beneficiaries FROM sqa_main sm
    WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.ffp_beneficiaries IS NOT NULL
    ORDER BY sm.reporting_month DESC LIMIT 1
  ) AS ffp_beneficiaries,

  /* ── Programmes quarterly: GIFSHIP enrolments ── */
  COALESCE((SELECT SUM(pe.gifship_enrolments) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 1 AND 3), 0) AS gifship_enr_q1,
  COALESCE((SELECT SUM(pe.gifship_enrolments) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 4 AND 6), 0) AS gifship_enr_q2,
  COALESCE((SELECT SUM(pe.gifship_enrolments) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 7 AND 9), 0) AS gifship_enr_q3,
  COALESCE((SELECT SUM(pe.gifship_enrolments) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 10 AND 12), 0) AS gifship_enr_q4,

  COALESCE((SELECT SUM(pe.gifship_premium) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 1 AND 3), 0) AS gifship_prem_q1,
  COALESCE((SELECT SUM(pe.gifship_premium) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 4 AND 6), 0) AS gifship_prem_q2,
  COALESCE((SELECT SUM(pe.gifship_premium) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 7 AND 9), 0) AS gifship_prem_q3,
  COALESCE((SELECT SUM(pe.gifship_premium) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 10 AND 12), 0) AS gifship_prem_q4,

  COALESCE((SELECT SUM(pe.ops_count) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 1 AND 3), 0) AS ops_q1,
  COALESCE((SELECT SUM(pe.ops_count) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 4 AND 6), 0) AS ops_q2,
  COALESCE((SELECT SUM(pe.ops_count) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 7 AND 9), 0) AS ops_q3,
  COALESCE((SELECT SUM(pe.ops_count) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 10 AND 12), 0) AS ops_q4,

  COALESCE((SELECT SUM(pe.fsship_new_enrolments) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 1 AND 3), 0) AS fsship_q1,
  COALESCE((SELECT SUM(pe.fsship_new_enrolments) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 4 AND 6), 0) AS fsship_q2,
  COALESCE((SELECT SUM(pe.fsship_new_enrolments) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 7 AND 9), 0) AS fsship_q3,
  COALESCE((SELECT SUM(pe.fsship_new_enrolments) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 10 AND 12), 0) AS fsship_q4,

  COALESCE((SELECT SUM(pe.extra_dependants) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 1 AND 3), 0) AS extra_dep_q1,
  COALESCE((SELECT SUM(pe.extra_dependants) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 4 AND 6), 0) AS extra_dep_q2,
  COALESCE((SELECT SUM(pe.extra_dependants) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 7 AND 9), 0) AS extra_dep_q3,
  COALESCE((SELECT SUM(pe.extra_dependants) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 10 AND 12), 0) AS extra_dep_q4,

  COALESCE((SELECT SUM(pe.extra_dependant_premium) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 1 AND 3), 0) AS extra_prem_q1,
  COALESCE((SELECT SUM(pe.extra_dependant_premium) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 4 AND 6), 0) AS extra_prem_q2,
  COALESCE((SELECT SUM(pe.extra_dependant_premium) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 7 AND 9), 0) AS extra_prem_q3,
  COALESCE((SELECT SUM(pe.extra_dependant_premium) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 10 AND 12), 0) AS extra_prem_q4,

  COALESCE((SELECT SUM(pe.additional_dependants) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 1 AND 3), 0) AS add_dep_q1,
  COALESCE((SELECT SUM(pe.additional_dependants) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 4 AND 6), 0) AS add_dep_q2,
  COALESCE((SELECT SUM(pe.additional_dependants) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 7 AND 9), 0) AS add_dep_q3,
  COALESCE((SELECT SUM(pe.additional_dependants) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 10 AND 12), 0) AS add_dep_q4,

  COALESCE((SELECT SUM(pe.change_of_provider) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 1 AND 3), 0) AS cop_q1,
  COALESCE((SELECT SUM(pe.change_of_provider) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 4 AND 6), 0) AS cop_q2,
  COALESCE((SELECT SUM(pe.change_of_provider) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 7 AND 9), 0) AS cop_q3,
  COALESCE((SELECT SUM(pe.change_of_provider) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.reporting_month BETWEEN 10 AND 12), 0) AS cop_q4,

  /* ── Scheme totals (latest month) ── */
  (SELECT pe.bhcpf_beneficiaries FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.bhcpf_beneficiaries IS NOT NULL ORDER BY pe.reporting_month DESC LIMIT 1) AS bhcpf_beneficiaries,
  (SELECT pe.bhcpf_facilities FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.bhcpf_facilities IS NOT NULL ORDER BY pe.reporting_month DESC LIMIT 1) AS bhcpf_facilities,
  (SELECT pe.tiship_lives FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.tiship_lives IS NOT NULL ORDER BY pe.reporting_month DESC LIMIT 1) AS tiship_lives,
  (SELECT pe.mha_lives FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.mha_lives IS NOT NULL ORDER BY pe.reporting_month DESC LIMIT 1) AS mha_lives,
  (SELECT pe.sshia_lives FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year AND pe.sshia_lives IS NOT NULL ORDER BY pe.reporting_month DESC LIMIT 1) AS sshia_lives,

  /* ── Complaints (annual sum) ── */
  COALESCE((SELECT SUM(sc.complaints_registered) FROM sqa_comp sc WHERE sc.state_id = sy.state_id AND sc.reporting_year = sy.reporting_year), 0) AS complaints_registered,
  COALESCE((SELECT SUM(sc.complaints_resolved) FROM sqa_comp sc WHERE sc.state_id = sy.state_id AND sc.reporting_year = sy.reporting_year), 0) AS complaints_resolved,
  COALESCE((SELECT SUM(sc.complaints_escalated) FROM sqa_comp sc WHERE sc.state_id = sy.state_id AND sc.reporting_year = sy.reporting_year), 0) AS complaints_escalated,

  /* ── IGR quarterly ── */
  COALESCE((SELECT SUM(ff.igr_amount) FROM fin_fin ff WHERE ff.state_id = sy.state_id AND ff.reporting_year = sy.reporting_year AND ff.reporting_month BETWEEN 1 AND 3), 0) AS igr_q1,
  COALESCE((SELECT SUM(ff.igr_amount) FROM fin_fin ff WHERE ff.state_id = sy.state_id AND ff.reporting_year = sy.reporting_year AND ff.reporting_month BETWEEN 4 AND 6), 0) AS igr_q2,
  COALESCE((SELECT SUM(ff.igr_amount) FROM fin_fin ff WHERE ff.state_id = sy.state_id AND ff.reporting_year = sy.reporting_year AND ff.reporting_month BETWEEN 7 AND 9), 0) AS igr_q3,
  COALESCE((SELECT SUM(ff.igr_amount) FROM fin_fin ff WHERE ff.state_id = sy.state_id AND ff.reporting_year = sy.reporting_year AND ff.reporting_month BETWEEN 10 AND 12), 0) AS igr_q4,

  /* ── SQA quarterly ── */
  COALESCE((SELECT SUM(sm.qa_conducted) FROM sqa_main sm WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.reporting_month BETWEEN 1 AND 3), 0) AS qa_q1,
  COALESCE((SELECT SUM(sm.qa_conducted) FROM sqa_main sm WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.reporting_month BETWEEN 4 AND 6), 0) AS qa_q2,
  COALESCE((SELECT SUM(sm.qa_conducted) FROM sqa_main sm WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.reporting_month BETWEEN 7 AND 9), 0) AS qa_q3,
  COALESCE((SELECT SUM(sm.qa_conducted) FROM sqa_main sm WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.reporting_month BETWEEN 10 AND 12), 0) AS qa_q4,

  COALESCE((SELECT SUM(sm.accreditation_requests) FROM sqa_main sm WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.reporting_month BETWEEN 1 AND 3), 0) AS acc_req_q1,
  COALESCE((SELECT SUM(sm.accreditation_requests) FROM sqa_main sm WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.reporting_month BETWEEN 4 AND 6), 0) AS acc_req_q2,
  COALESCE((SELECT SUM(sm.accreditation_requests) FROM sqa_main sm WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.reporting_month BETWEEN 7 AND 9), 0) AS acc_req_q3,
  COALESCE((SELECT SUM(sm.accreditation_requests) FROM sqa_main sm WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.reporting_month BETWEEN 10 AND 12), 0) AS acc_req_q4,

  COALESCE((SELECT SUM(sm.accreditation_conducted) FROM sqa_main sm WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.reporting_month BETWEEN 1 AND 3), 0) AS acc_con_q1,
  COALESCE((SELECT SUM(sm.accreditation_conducted) FROM sqa_main sm WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.reporting_month BETWEEN 4 AND 6), 0) AS acc_con_q2,
  COALESCE((SELECT SUM(sm.accreditation_conducted) FROM sqa_main sm WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.reporting_month BETWEEN 7 AND 9), 0) AS acc_con_q3,
  COALESCE((SELECT SUM(sm.accreditation_conducted) FROM sqa_main sm WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year AND sm.reporting_month BETWEEN 10 AND 12), 0) AS acc_con_q4,

  COALESCE((SELECT SUM(po.marketing_sensitization) FROM prg_out po WHERE po.state_id = sy.state_id AND po.reporting_year = sy.reporting_year AND po.reporting_month BETWEEN 1 AND 3), 0) AS mkt_q1,
  COALESCE((SELECT SUM(po.marketing_sensitization) FROM prg_out po WHERE po.state_id = sy.state_id AND po.reporting_year = sy.reporting_year AND po.reporting_month BETWEEN 4 AND 6), 0) AS mkt_q2,
  COALESCE((SELECT SUM(po.marketing_sensitization) FROM prg_out po WHERE po.state_id = sy.state_id AND po.reporting_year = sy.reporting_year AND po.reporting_month BETWEEN 7 AND 9), 0) AS mkt_q3,
  COALESCE((SELECT SUM(po.marketing_sensitization) FROM prg_out po WHERE po.state_id = sy.state_id AND po.reporting_year = sy.reporting_year AND po.reporting_month BETWEEN 10 AND 12), 0) AS mkt_q4,

  /* ── Outreach / reconciliation ── */
  COALESCE((SELECT SUM(po.stakeholder_meetings) FROM prg_out po WHERE po.state_id = sy.state_id AND po.reporting_year = sy.reporting_year), 0) AS stakeholder_meetings,
  COALESCE((SELECT SUM(po.media_appearances) FROM prg_out po WHERE po.state_id = sy.state_id AND po.reporting_year = sy.reporting_year), 0) AS media_appearances,
  COALESCE((SELECT SUM(ff.reconciliation_meetings) FROM fin_fin ff WHERE ff.state_id = sy.state_id AND ff.reporting_year = sy.reporting_year), 0) AS reconciliation_meetings,
  COALESCE((SELECT SUM(ff.total_indebtedness) FROM fin_fin ff WHERE ff.state_id = sy.state_id AND ff.reporting_year = sy.reporting_year), 0) AS total_indebtedness,
  COALESCE((SELECT SUM(ff.amount_recovered) FROM fin_fin ff WHERE ff.state_id = sy.state_id AND ff.reporting_year = sy.reporting_year), 0) AS amount_recovered,

  /* ── Coverage metadata ── */
  (SELECT COUNT(DISTINCT ff.reporting_month) FROM fin_fin ff WHERE ff.state_id = sy.state_id AND ff.reporting_year = sy.reporting_year) AS finance_months,
  (SELECT COUNT(DISTINCT pe.reporting_month) FROM prg_enr pe WHERE pe.state_id = sy.state_id AND pe.reporting_year = sy.reporting_year) AS programmes_months,
  (SELECT COUNT(DISTINCT sm.reporting_month) FROM sqa_main sm WHERE sm.state_id = sy.state_id AND sm.reporting_year = sy.reporting_year) AS sqa_months

FROM state_years sy
INNER JOIN state_offices so ON so.id = sy.state_id
LEFT JOIN zonal_offices zo ON zo.id = so.zonal_id;
