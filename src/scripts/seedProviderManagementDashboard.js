/**
 * Seed Provider Management (accreditation) activity data for dashboards.
 *
 * Default scope (production-friendly demo):
 *   Zone  — North West
 *   State — Kano
 *
 *   node src/scripts/seedProviderManagementDashboard.js
 *
 * Optional overrides:
 *   PM_SEED_ZONE="North West" PM_SEED_STATE="Kano" node src/scripts/seedProviderManagementDashboard.js
 */
require("dotenv").config();
const { Op } = require("sequelize");
const {
  AccreditationReport,
  AccreditationReportLine,
  StateOffice,
  ZonalOffice,
} = require("../models");

const YEAR = new Date().getFullYear();
const ZONE_NAME = process.env.PM_SEED_ZONE || "North West";
const STATE_NAME = process.env.PM_SEED_STATE || "Kano";

const ACTIVITIES = [
  { key: "accreditation", category: "Accreditation", code: "PM-0001" },
  { key: "reaccreditation", category: "Re-accreditation", code: "PM-0002" },
  { key: "qa-inspections", category: "Quality Assurance", code: "PM-0003" },
  { key: "medical-audits", category: "Medical Audit", code: "PM-0004" },
];
const PROGRAMMES = ["FSSHIP", "BHCPF", "Other"];
const STATUSES = ["Completed", "Completed", "Completed", "In Progress", "Not Conducted", "Deferred"];

function pick(arr, i) {
  return arr[i % arr.length];
}

async function resolveScope() {
  // MySQL: case-insensitive match via LOWER + LIKE
  const zone = await ZonalOffice.findOne({
    where: {
      [Op.or]: [
        { description: { [Op.like]: `%${ZONE_NAME}%` } },
        { zonal_code: "NW" },
        { zonal_code: "nw" },
      ],
    },
  });
  if (!zone) throw new Error(`Zone not found matching "${ZONE_NAME}"`);

  const state = await StateOffice.findOne({
    where: {
      zonal_id: zone.id,
      description: { [Op.like]: `%${STATE_NAME}%` },
    },
    include: [{ model: ZonalOffice, as: "zone", attributes: ["id", "description", "zonal_code"] }],
  });
  if (!state) {
    throw new Error(`State not found matching "${STATE_NAME}" in zone "${zone.description}"`);
  }

  return { zone, state };
}

async function main() {
  const { zone, state } = await resolveScope();
  console.log(`📍  Scope: ${zone.description} (${zone.zonal_code}) → ${state.description}\n`);

  let reportN = 0;
  let lineN = 0;
  let si = 0;

  // One report per month × activity so Level 1–4 charts are populated for this state
  for (let month = 1; month <= 12; month++) {
    for (let ai = 0; ai < ACTIVITIES.length; ai++) {
      const activity = ACTIVITIES[ai];
      const programme = pick(PROGRAMMES, month + ai);
      const status = pick(STATUSES, month + ai);
      const planned = 18 + ((month * 5 + ai * 7) % 35);
      const covered = status === "Completed"
        ? Math.round(planned * (0.6 + ((month + ai) % 4) * 0.08))
        : status === "In Progress"
          ? Math.round(planned * 0.4)
          : Math.round(planned * 0.12);
      const totalState = 120;
      // Keep short — reference_id column is limited
      const actCode = ["ACC", "REA", "QA", "MA"][ai];
      const ref = `PM${YEAR}K${String(month).padStart(2, "0")}${actCode}`;

      let report = await AccreditationReport.findOne({ where: { reference_id: ref } });
      if (!report) {
        report = await AccreditationReport.create({
          reference_id: ref,
          zone_id: zone.id,
          state_id: state.id,
          reporting_year: YEAR,
          reporting_month: month,
          submission_date: `${YEAR}-${String(month).padStart(2, "0")}-20`,
          submitted_by: "PM Dashboard Seed",
          status: "submitted",
          planned_activities: 1,
          activity_module: activity.key,
        });
        reportN += 1;
      } else {
        await report.update({
          zone_id: zone.id,
          state_id: state.id,
          activity_module: activity.key,
          status: "submitted",
          planned_activities: 1,
          reporting_year: YEAR,
          reporting_month: month,
        });
      }

      await AccreditationReportLine.destroy({ where: { report_id: report.id } });
      const metrics = {};
      if (activity.key === "accreditation") {
        metrics["Number of Facilities Awaiting Accreditation"] = 25 + (month % 8) * 6;
        if (programme === "BHCPF") metrics["Number of PHCs Awaiting Accreditation"] = 14 + (month % 5) * 3;
      }
      if (activity.key === "reaccreditation") {
        metrics["Number of Facilities Awaiting Re-accreditation"] = 12 + (month % 6) * 4;
        if (programme === "BHCPF") metrics["Number of PHCs Awaiting Re-accreditation"] = 9 + (month % 4) * 2;
      }

      await AccreditationReportLine.create({
        report_id: report.id,
        indicator: "accreditation_applications",
        primary_count: covered,
        secondary_count: planned,
        activity_template: {
          provider_management_id: `PM-NW-KAN-${YEAR}-${String(month * 10 + ai).padStart(4, "0")}`,
          form_type: activity.key,
          engagement_code: activity.code,
          engagement_category: activity.category,
          related_programme: programme,
          bhcpf_activity_type: programme === "BHCPF"
            ? (activity.key === "reaccreditation" ? "Reaccreditation" : "Accreditation")
            : null,
          total_facilities_in_state: totalState,
          facilities_planned: planned,
          activity_date: `${YEAR}-${String(month).padStart(2, "0")}-15`,
          facilities_covered: covered,
          funding_option: "Routine",
          activity_status: status,
          remarks: `Dashboard seed · ${zone.description} · ${state.description}`,
          metrics,
          facilities_accredited: activity.key === "accreditation" ? covered : 0,
          facilities_reaccredited: activity.key === "reaccreditation" ? covered : 0,
          phcs_accredited: programme === "BHCPF" && activity.key === "accreditation" ? covered : 0,
          phcs_reaccredited: programme === "BHCPF" && activity.key === "reaccreditation" ? covered : 0,
          programs_supported: [programme],
        },
      });
      lineN += 1;
      si += 1;
    }
  }

  console.log(`✅  Seeded/updated ${reportN} new reports, ${lineN} activity lines for ${YEAR}`);
  console.log(`    Zone: ${zone.description} | State: ${state.description}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
