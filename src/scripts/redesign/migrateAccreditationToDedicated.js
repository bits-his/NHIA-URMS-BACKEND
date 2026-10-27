/**
 * Split legacy accreditation_reports (filtered by activity_module) into
 * dedicated provider_* tables.
 *
 * Usage: npm run db:redesign:migrate-provider
 */
require("dotenv").config();
const sequelize = require("../../config/database");
require("../../models/index");
const {
  ProviderAccreditationReport,
  ProviderAccreditationReportLine,
  ProviderReaccreditationReport,
  ProviderReaccreditationReportLine,
  ProviderMedicalAuditReport,
  ProviderMedicalAuditReportLine,
  ProviderQaInspectionReport,
  ProviderQaInspectionReportLine,
} = require("../../models/providerManagement");

const TARGETS = {
  accreditation: {
    Report: ProviderAccreditationReport,
    Line: ProviderAccreditationReportLine,
    prefix: "PACC",
  },
  reaccreditation: {
    Report: ProviderReaccreditationReport,
    Line: ProviderReaccreditationReportLine,
    prefix: "PREC",
  },
  "medical-audits": {
    Report: ProviderMedicalAuditReport,
    Line: ProviderMedicalAuditReportLine,
    prefix: "PMED",
  },
  "qa-inspections": {
    Report: ProviderQaInspectionReport,
    Line: ProviderQaInspectionReportLine,
    prefix: "PQA",
  },
};

function classify(row) {
  const mod = String(row.activity_module || "").trim().toLowerCase();
  if (TARGETS[mod]) return mod;
  const cat = String(
    (row.lines && row.lines[0] && row.lines[0].activity_template
      && (row.lines[0].activity_template.engagement_category
        || row.lines[0].activity_template.category))
      || "",
  ).toLowerCase();
  if (cat.includes("re-accredit") || cat.includes("reaccredit")) return "reaccreditation";
  if (cat.includes("quality") || cat.includes("qa")) return "qa-inspections";
  if (cat.includes("medical") || cat.includes("audit")) return "medical-audits";
  return "accreditation";
}

(async () => {
  try {
    await sequelize.authenticate();

    // Ensure tables exist
    for (const t of Object.values(TARGETS)) {
      await t.Report.sync({ alter: true });
      await t.Line.sync({ alter: true });
    }

    const [headers] = await sequelize.query(
      `SELECT * FROM accreditation_reports ORDER BY id ASC`,
    );
    console.log(`Found ${headers.length} legacy accreditation_reports`);

    const counts = {
      accreditation: 0,
      reaccreditation: 0,
      "medical-audits": 0,
      "qa-inspections": 0,
      skipped: 0,
    };

    for (const h of headers) {
      const [lines] = await sequelize.query(
        `SELECT * FROM accreditation_report_lines WHERE report_id = ? ORDER BY id ASC`,
        { replacements: [h.id] },
      );
      h.lines = lines.map((l) => ({
        ...l,
        activity_template:
          typeof l.activity_template === "string"
            ? (() => { try { return JSON.parse(l.activity_template); } catch { return l.activity_template; } })()
            : l.activity_template,
      }));

      const key = classify(h);
      const target = TARGETS[key];
      if (!target) {
        counts.skipped += 1;
        continue;
      }

      const existing = await target.Report.findOne({
        where: {
          zone_id: h.zone_id,
          state_id: h.state_id,
          reporting_year: h.reporting_year,
          reporting_month: h.reporting_month,
        },
      });
      if (existing) {
        counts.skipped += 1;
        continue;
      }

      // Keep original reference when unique; otherwise mint new
      let referenceId = h.reference_id;
      const refClash = await target.Report.findOne({ where: { reference_id: referenceId } });
      if (refClash) {
        referenceId = `${target.prefix}-${h.reporting_year}-${String(h.id).padStart(5, "0")}`;
      }

      const created = await target.Report.create({
        reference_id: referenceId,
        zone_id: h.zone_id,
        state_id: h.state_id,
        reporting_year: h.reporting_year,
        reporting_month: h.reporting_month,
        submission_date: h.submission_date,
        submitted_by: h.submitted_by,
        status: h.status || "draft",
        planned_activities: h.planned_activities,
        coordinator_review_note: h.coordinator_review_note,
        coordinator_reviewed_by: h.coordinator_reviewed_by,
        coordinator_reviewed_at: h.coordinator_reviewed_at,
        created_at: h.created_at,
        updated_at: h.updated_at,
      });

      if (lines.length) {
        await target.Line.bulkCreate(
          lines.map((l) => ({
            report_id: created.id,
            indicator: l.indicator,
            primary_count: l.primary_count || 0,
            secondary_count: l.secondary_count || 0,
            activity_template: typeof l.activity_template === "string"
              ? (() => { try { return JSON.parse(l.activity_template); } catch { return null; } })()
              : l.activity_template,
          })),
        );
      }
      counts[key] += 1;
    }

    console.log("✅  Migration counts:", counts);
    process.exit(0);
  } catch (err) {
    console.error("❌  migrate failed:", err);
    process.exit(1);
  }
})();
