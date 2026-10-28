/**
 * Create / replace HMO Indebtedness analysis views.
 * Master VIEW is a flat wide grain; API may further group for Template 3 UI.
 */
async function ensureHmoIndebtednessViews(sequelize) {
  await sequelize.query(`DROP VIEW IF EXISTS hmo_indebtedness_facts_v`);
  await sequelize.query(`DROP VIEW IF EXISTS hmo_indebtedness_master_v`);

  // Long facts: collation alleged unpivoted + recon measures
  await sequelize.query(`
    CREATE VIEW hmo_indebtedness_facts_v AS
    SELECT
      r.zonal_code,
      r.state_code,
      r.reporting_year,
      r.reporting_month,
      r.quarter,
      l.hmo_name,
      l.hmo_code,
      l.facility_name AS hcf_name,
      l.hcf_code,
      'cap' AS stream,
      'alleged' AS measure,
      l.nhia_cap AS amount,
      'collation' AS source,
      r.reference_id AS report_reference_id
    FROM hmo_indebtedness_reports r
    INNER JOIN hmo_indebtedness_lines l ON l.report_reference_id = r.reference_id
    UNION ALL
    SELECT r.zonal_code, r.state_code, r.reporting_year, r.reporting_month, r.quarter,
      l.hmo_name, l.hmo_code, l.facility_name, l.hcf_code,
      'ffs', 'alleged', l.nhia_ffs, 'collation', r.reference_id
    FROM hmo_indebtedness_reports r
    INNER JOIN hmo_indebtedness_lines l ON l.report_reference_id = r.reference_id
    UNION ALL
    SELECT r.zonal_code, r.state_code, r.reporting_year, r.reporting_month, r.quarter,
      l.hmo_name, l.hmo_code, l.facility_name, l.hcf_code,
      'phi', 'alleged', l.phi, 'collation', r.reference_id
    FROM hmo_indebtedness_reports r
    INNER JOIN hmo_indebtedness_lines l ON l.report_reference_id = r.reference_id
    UNION ALL
    SELECT rr.zonal_code, rr.state_code, rr.reporting_year, rr.reporting_month, rr.quarter,
      rr.hmo_name, rr.hmo_code, rl.hcf_name, rl.hcf_code,
      rr.stream_type, 'alleged', rl.alleged_amount, 'recon', rr.reference_id
    FROM hmo_recon_reports rr
    INNER JOIN hmo_recon_lines rl ON rl.report_reference_id = rr.reference_id
    UNION ALL
    SELECT rr.zonal_code, rr.state_code, rr.reporting_year, rr.reporting_month, rr.quarter,
      rr.hmo_name, rr.hmo_code, rl.hcf_name, rl.hcf_code,
      rr.stream_type, 'actual', rl.actual_amount, 'recon', rr.reference_id
    FROM hmo_recon_reports rr
    INNER JOIN hmo_recon_lines rl ON rl.report_reference_id = rr.reference_id
    UNION ALL
    SELECT rr.zonal_code, rr.state_code, rr.reporting_year, rr.reporting_month, rr.quarter,
      rr.hmo_name, rr.hmo_code, rl.hcf_name, rl.hcf_code,
      rr.stream_type, 'agreed', rl.agreed_amount, 'recon', rr.reference_id
    FROM hmo_recon_reports rr
    INNER JOIN hmo_recon_lines rl ON rl.report_reference_id = rr.reference_id
    UNION ALL
    SELECT rr.zonal_code, rr.state_code, rr.reporting_year, rr.reporting_month, rr.quarter,
      rr.hmo_name, rr.hmo_code, rl.hcf_name, rl.hcf_code,
      rr.stream_type, 'paid', rl.amount_paid, 'recon', rr.reference_id
    FROM hmo_recon_reports rr
    INNER JOIN hmo_recon_lines rl ON rl.report_reference_id = rr.reference_id
    UNION ALL
    SELECT rr.zonal_code, rr.state_code, rr.reporting_year, rr.reporting_month, rr.quarter,
      rr.hmo_name, rr.hmo_code, rl.hcf_name, rl.hcf_code,
      rr.stream_type, 'outstanding', rl.outstanding, 'recon', rr.reference_id
    FROM hmo_recon_reports rr
    INNER JOIN hmo_recon_lines rl ON rl.report_reference_id = rr.reference_id
  `);

  // Wide master grain from facts (alleged from collation preferred via MAX on measures)
  await sequelize.query(`
    CREATE VIEW hmo_indebtedness_master_v AS
    SELECT
      f.zonal_code,
      f.state_code,
      f.reporting_year,
      f.reporting_month,
      f.quarter,
      f.hmo_name,
      f.hmo_code,
      f.hcf_name AS facility_name,
      f.hcf_code,
      MAX(CASE WHEN f.source = 'collation' AND f.stream = 'cap' AND f.measure = 'alleged' THEN f.amount END) AS alleged_cap,
      MAX(CASE WHEN f.source = 'collation' AND f.stream = 'ffs' AND f.measure = 'alleged' THEN f.amount END) AS alleged_ffs,
      MAX(CASE WHEN f.source = 'collation' AND f.stream = 'phi' AND f.measure = 'alleged' THEN f.amount END) AS alleged_phi,
      MAX(CASE WHEN f.source = 'recon' AND f.stream = 'cap' AND f.measure = 'actual' THEN f.amount END) AS actual_cap,
      MAX(CASE WHEN f.source = 'recon' AND f.stream = 'ffs' AND f.measure = 'actual' THEN f.amount END) AS actual_ffs,
      MAX(CASE WHEN f.source = 'recon' AND f.stream = 'phi' AND f.measure = 'actual' THEN f.amount END) AS actual_phi,
      SUM(CASE WHEN f.source = 'recon' AND f.measure = 'agreed' THEN f.amount ELSE 0 END) AS agreed_amount,
      SUM(CASE WHEN f.source = 'recon' AND f.measure = 'paid' THEN f.amount ELSE 0 END) AS amount_paid
    FROM hmo_indebtedness_facts_v f
    GROUP BY
      f.zonal_code, f.state_code, f.reporting_year, f.reporting_month, f.quarter,
      f.hmo_name, f.hmo_code, f.hcf_name, f.hcf_code
  `);
}

module.exports = { ensureHmoIndebtednessViews };
