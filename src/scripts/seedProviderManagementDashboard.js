/**
 * Seed Provider Management dashboard activity data.
 *
 * Default: North West zone (all states in NW), with denser data for Kano.
 *
 *   node src/scripts/seedProviderManagementDashboard.js
 *
 * Optional:
 *   PM_SEED_ZONE="North West" PM_SEED_STATE="Kano" node ...
 *   PM_SEED_ZONE_ONLY=1  → only that zone's states (default)
 *   PM_SEED_NATIONAL=1   → also light-seed other zones for DG/SDO national charts
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
const STATE_FOCUS = process.env.PM_SEED_STATE || "Kano";
const NATIONAL = process.env.PM_SEED_NATIONAL === "1" || process.argv.includes("--national");

const ACTIVITIES = [
  { key: "accreditation", category: "Accreditation", code: "PM-0001", short: "ACC" },
  { key: "reaccreditation", category: "Re-accreditation", code: "PM-0002", short: "REA" },
  { key: "qa-inspections", category: "Quality Assurance", code: "PM-0003", short: "QA" },
  { key: "medical-audits", category: "Medical Audit", code: "PM-0004", short: "MA" },
];
const PROGRAMMES = ["FSSHIP", "BHCPF", "Other"];
const STATUSES = ["Completed", "Completed", "Completed", "In Progress", "Not Conducted", "Deferred"];

function pick(arr, i) {
  return arr[i % arr.length];
}

async function resolveZone() {
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
  return zone;
}

async function seedState(state, zone, { dense = false } = {}) {
  let reportN = 0;
  let lineN = 0;
  const months = dense ? 12 : 6;
  const acts = dense ? ACTIVITIES : ACTIVITIES.slice(0, 3);

  for (let month = 1; month <= months; month++) {
    for (let ai = 0; ai < acts.length; ai++) {
      const activity = acts[ai];
      const programme = pick(PROGRAMMES, month + ai + state.id);
      const status = pick(STATUSES, month + ai + state.id);
      const planned = dense
        ? 18 + ((month * 5 + ai * 7 + state.id) % 35)
        : 10 + ((month * 3 + ai + state.id) % 20);
      const covered = status === "Completed"
        ? Math.round(planned * (0.6 + ((month + ai) % 4) * 0.08))
        : status === "In Progress"
          ? Math.round(planned * 0.4)
          : Math.round(planned * 0.12);
      const totalState = dense ? 120 : 80 + (state.id % 5) * 10;
      const code = String(state.code || state.id).replace(/[^A-Z0-9]/gi, "").slice(0, 3).toUpperCase() || "ST";
      const ref = `PM${YEAR}${code}${String(month).padStart(2, "0")}${activity.short}`;

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
        metrics["Number of Facilities Awaiting Accreditation"] = 20 + (month % 8) * 5;
        if (programme === "BHCPF") metrics["Number of PHCs Awaiting Accreditation"] = 12 + (month % 5) * 3;
      }
      if (activity.key === "reaccreditation") {
        metrics["Number of Facilities Awaiting Re-accreditation"] = 10 + (month % 6) * 4;
        if (programme === "BHCPF") metrics["Number of PHCs Awaiting Re-accreditation"] = 8 + (month % 4) * 2;
      }

      const accredited = activity.key === "accreditation" ? covered : 0;
      const reaccredited = activity.key === "reaccreditation" ? covered : 0;

      await AccreditationReportLine.create({
        report_id: report.id,
        indicator: "accreditation_applications",
        primary_count: covered,
        secondary_count: planned,
        activity_template: {
          provider_management_id: `PM-${code}-${YEAR}-${String(month * 10 + ai).padStart(4, "0")}`,
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
          facilities_accredited: accredited,
          facilities_reaccredited: reaccredited,
          phcs_accredited: programme === "BHCPF" && activity.key === "accreditation" ? covered : 0,
          phcs_reaccredited: programme === "BHCPF" && activity.key === "reaccreditation" ? covered : 0,
          programs_supported: [programme],
        },
      });
      lineN += 1;
    }
  }
  return { reportN, lineN };
}

async function main() {
  const focusZone = await resolveZone();
  console.log(`📍  Primary zone: ${focusZone.description} (${focusZone.zonal_code})\n`);

  const nwStates = await StateOffice.findAll({
    where: { zonal_id: focusZone.id },
    order: [["description", "ASC"]],
  });
  if (!nwStates.length) throw new Error(`No states in ${focusZone.description}`);

  let reportN = 0;
  let lineN = 0;

  for (const state of nwStates) {
    const dense = new RegExp(STATE_FOCUS, "i").test(state.description);
    const r = await seedState(state, focusZone, { dense });
    reportN += r.reportN;
    lineN += r.lineN;
    console.log(`  ${dense ? "★" : "·"} ${state.description.padEnd(22)} +${r.lineN} lines`);
  }

  if (NATIONAL) {
    console.log("\nSeeding light national samples for other zones…");
    const otherZones = await ZonalOffice.findAll({
      where: { id: { [Op.ne]: focusZone.id } },
      order: [["id", "ASC"]],
    });
    for (const zone of otherZones) {
      const state = await StateOffice.findOne({ where: { zonal_id: zone.id }, order: [["id", "ASC"]] });
      if (!state) continue;
      const r = await seedState(state, zone, { dense: false });
      reportN += r.reportN;
      lineN += r.lineN;
      console.log(`  · ${zone.description.padEnd(22)} ${state.description} +${r.lineN} lines`);
    }
  }

  console.log(`\n✅  Seeded/updated ${reportN} new reports, ${lineN} activity lines for ${YEAR}`);
  console.log(`    Focus: ${focusZone.description} / denser data for ${STATE_FOCUS}`);
  if (!NATIONAL) console.log("    Tip: add --national for other zones (DG/SDO national charts)");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
