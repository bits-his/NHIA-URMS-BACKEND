/**
 * Seed data so role dashboards (SC / Zonal / SDO / DG) show live KPIs, trends, bands & escalations.
 * Idempotent — stable DASH-* reference IDs.
 *
 * Run after zones/states exist:
 *   node src/scripts/seedRoleDashboardDemo.js
 *
 * Optional: run seedStateOfficeData.js first for richer module samples.
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  StateOffice, ZonalOffice,
  EnrolmentReport,
  StakeholderReport, StakeholderReportLine,
  EnrolmentDriveReport, EnrolmentDriveReportLine,
  ChallengesReport, ChallengesReportLine,
  WeeklyActionableReport, WeeklyActionableReportLine,
  ContractedServicesReport, ContractedServicesReportLine,
  MonitoringVisit,
} = require("../models");
const { syncStateOfficeTables } = require("./stateOfficeTableSync");

const SUBMITTED_BY = "Dashboard Demo Seed";

function shiftMonth(y, m, delta) {
  const d = new Date(y, m - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function lastSixMonths(endYear, endMonth) {
  const out = [];
  for (let i = 5; i >= 0; i--) {
    out.push(shiftMonth(endYear, endMonth, -i));
  }
  return out;
}

function dashRef(prefix, stateId, year, month) {
  return `DASH-${prefix}-${stateId}-${year}-${String(month).padStart(2, "0")}`;
}

function header(geo, year, month, status) {
  return {
    zone_id: geo.zone_id,
    state_id: geo.state_id,
    reporting_year: year,
    reporting_month: month,
    submission_date: `${year}-${String(month).padStart(2, "0")}-25`,
    submitted_by: SUBMITTED_BY,
    status,
  };
}

function statusForProfile(profile, month, currentMonth) {
  if (month < currentMonth) return profile === "weak" ? "submitted" : "approved";
  if (profile === "strong") return "approved";
  if (profile === "medium") return month === currentMonth ? "submitted" : "approved";
  return month === currentMonth ? "draft" : "submitted";
}

async function listCanonicalStates() {
  const rows = await StateOffice.findAll({
    attributes: ["id", "code", "description", "zonal_id"],
    order: [["description", "ASC"], ["id", "ASC"]],
  });
  const byDesc = new Map();
  for (const s of rows) {
    const key = s.description.trim().toLowerCase();
    const legacy = /^SO-\d+$/i.test(s.code || "");
    const existing = byDesc.get(key);
    if (!existing || (legacy && !/^SO-\d+$/i.test(existing.code || ""))) {
      if (!existing || !legacy) byDesc.set(key, s);
    }
  }
  return [...byDesc.values()].filter((s) => s.zonal_id);
}

async function ensureEnrolment(geo, year, month, status) {
  const ref = dashRef("ENR", geo.state_id, year, month);
  const [, created] = await EnrolmentReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...header(geo, year, month, status), reference_id: ref },
  });
  return created ? 1 : 0;
}

async function ensureContracted(geo, year, month, status) {
  const ref = dashRef("CSR", geo.state_id, year, month);
  const [report, created] = await ContractedServicesReport.findOrCreate({
    where: { reference_id: ref },
    defaults: { ...header(geo, year, month, status), reference_id: ref },
  });
  if (created) {
    await ContractedServicesReportLine.bulkCreate([
      { report_id: report.id, service: "security", month, beneficiary: `${geo.label} Security Ltd`, amount: 180000 + month * 5000 },
      { report_id: report.id, service: "cleaning", month, beneficiary: `${geo.label} Cleaning Co.`, amount: 95000 },
    ]);
  }
  return created ? 1 : 0;
}

async function ensureWeeklyActionable(geo, year, month, status, profile, currentMonth) {
  const ref = dashRef("WKA", geo.state_id, year, month);
  const [report, created] = await WeeklyActionableReport.findOrCreate({
    where: { reference_id: ref },
    defaults: {
      ...header(geo, year, month, status),
      reference_id: ref,
      reporting_week: ((month - 1) % 4) + 1,
    },
  });
  if (created) {
    const onCurrent = month === currentMonth;
    const lineStatus = profile === "weak" && onCurrent ? "escalated" : profile === "medium" ? "awaiting_response" : "resolved";
    await WeeklyActionableReportLine.bulkCreate([
      {
        report_id: report.id,
        issue_request: `Capitation delay affecting ${geo.label} facilities`,
        category: "budgetary",
        impact: "high",
        urgency: "high",
        user_department: "Finance",
        priority_level: "P1",
        status: lineStatus,
      },
      {
        report_id: report.id,
        issue_request: `ICT connectivity at ${geo.label} state office`,
        category: "operational",
        impact: profile === "weak" ? "high" : "medium",
        urgency: "medium",
        user_department: "ICT",
        priority_level: "P2",
        status: profile === "weak" ? "escalated" : "awaiting_further_info",
      },
    ]);
  }
  return created ? 1 : 0;
}

async function ensureStakeholder(geo, year, month, status, profile) {
  const ref = dashRef("STK", geo.state_id, year, month);
  const planned = profile === "weak" ? 6 : profile === "medium" ? 4 : 3;
  const completed = profile === "weak" ? 2 : profile === "medium" ? 3 : 3;
  const [report, created] = await StakeholderReport.findOrCreate({
    where: { reference_id: ref },
    defaults: {
      ...header(geo, year, month, status),
      reference_id: ref,
      planned_activities: planned,
    },
  });
  if (created) {
    const d = String(month).padStart(2, "0");
    const lines = [];
    for (let i = 0; i < planned; i++) {
      lines.push({
        report_id: report.id,
        engagement_category: i % 2 === 0 ? "Sensitization" : "Stakeholder meeting",
        specific_activity: `${geo.label} engagement activity ${i + 1}`,
        activity_date: `${year}-${d}-${String(10 + i).padStart(2, "0")}`,
        activity_status: i < completed ? "completed" : "planned",
        stakeholders_engaged: 40 + i * 12,
        planned_target_stakeholders: 50 + i * 10,
      });
    }
    await StakeholderReportLine.bulkCreate(lines);
  }
  return created ? 1 : 0;
}

async function ensureEnrolmentDrive(geo, year, month, status, profile) {
  const ref = dashRef("DRV", geo.state_id, year, month);
  const planned = profile === "weak" ? 8 : 4;
  const completed = profile === "weak" ? 2 : profile === "medium" ? 3 : 4;
  const [report, created] = await EnrolmentDriveReport.findOrCreate({
    where: { reference_id: ref },
    defaults: {
      ...header(geo, year, month, status),
      reference_id: ref,
      drive_type: "advocacy",
      planned_activities: planned,
    },
  });
  if (created) {
    const d = String(month).padStart(2, "0");
    const lines = [];
    for (let i = 0; i < planned; i++) {
      lines.push({
        report_id: report.id,
        activity_category: "Community enrolment drive",
        specific_activity: `${geo.label} drive ${i + 1}`,
        activity_date: `${year}-${d}-${String(5 + i * 2).padStart(2, "0")}`,
        activity_status: i < completed ? "completed" : "pending",
        new_enrolments: i < completed ? 25 + i * 8 : 0,
        planned_target_audience: 100 + i * 20,
        target_audience_reached: i < completed ? 90 + i * 15 : 0,
      });
    }
    await EnrolmentDriveReportLine.bulkCreate(lines);
  }
  return created ? 1 : 0;
}

const CHALLENGE_TEMPLATES = [
  { category: "Capitation delays", dept: "Finance", support: "Expedited payment release", status: "escalated" },
  { category: "ICT infrastructure", dept: "ICT", support: "Bandwidth upgrade", status: "in-progress" },
  { category: "Staffing gaps", dept: "Admin/HR", support: "Additional desk officers", status: "under review" },
  { category: "Provider accreditation backlog", dept: "SQA", support: "Accreditation surge team", status: "action initiated" },
];

async function ensureChallenges(geo, year, month, status) {
  if (month % 3 !== 0) return 0;
  const ref = dashRef("CHL", geo.state_id, year, month);
  const [report, created] = await ChallengesReport.findOrCreate({
    where: { reference_id: ref },
    defaults: {
      ...header(geo, year, month, status),
      reference_id: ref,
      challenges: `Sample challenges for ${geo.label}`,
      recommendations: "National coordination recommended where systemic.",
    },
  });
  if (created) {
    const tpl = CHALLENGE_TEMPLATES[(geo.state_id + month) % CHALLENGE_TEMPLATES.length];
    await ChallengesReportLine.bulkCreate([
      {
        report_id: report.id,
        challenge_code: `CH-${geo.state_id}-${month}`,
        challenge_category: tpl.category,
        specific_challenge: `${tpl.category} in ${geo.label}`,
        challenge_details: "Recurring issue flagged for dashboard demo.",
        severity: "high",
        support_required: tpl.support,
        responsible_department: tpl.dept,
        status: tpl.status,
      },
      {
        report_id: report.id,
        challenge_code: `CH-${geo.state_id}-${month}-B`,
        challenge_category: "Data quality",
        specific_challenge: "Incomplete monthly returns",
        severity: "medium",
        support_required: "Training & templates",
        responsible_department: "SOC/Zones",
        status: "in progress",
      },
    ]);
  }
  return created ? 1 : 0;
}

async function ensureMonitoringVisit(geo, year, month, status, seq) {
  const ref = dashRef("MV", geo.state_id, year, month * 10 + seq);
  const d = String(month).padStart(2, "0");
  const day = String(Math.min(8 + seq * 5, 26)).padStart(2, "0");
  const [, created] = await MonitoringVisit.findOrCreate({
    where: { reference_id: ref },
    defaults: {
      reference_id: ref,
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      facility_name: `${geo.label} General Hospital ${seq}`,
      facility_type: "public",
      visit_date: `${year}-${d}-${day}`,
      monitoring_type: seq % 2 === 0 ? "spot_check" : "routine",
      monitoring_officer: "NHIA Monitoring Team",
      status: status === "draft" ? "draft" : status === "submitted" ? "submitted" : "approved",
      submitted_by: SUBMITTED_BY,
      percentage_score: 72 + (month % 5) * 4,
      compliance_rating: "substantially_compliant",
    },
  });
  return created ? 1 : 0;
}

async function seedStateMonth(geo, year, month, profile, currentMonth) {
  const status = statusForProfile(profile, month, currentMonth);
  const counts = {
    enrolment: 0, weekly: 0, stakeholder: 0, drive: 0, challenges: 0, contracted: 0, visits: 0,
  };
  counts.enrolment += await ensureEnrolment(geo, year, month, status);
  counts.weekly += await ensureWeeklyActionable(geo, year, month, status, profile, currentMonth);
  counts.stakeholder += await ensureStakeholder(geo, year, month, status, profile);
  counts.drive += await ensureEnrolmentDrive(geo, year, month, status, profile);
  counts.challenges += await ensureChallenges(geo, year, month, status);
  counts.contracted += await ensureContracted(geo, year, month, status);
  counts.visits += await ensureMonitoringVisit(geo, year, month, status, 1);
  if (month % 2 === 0) counts.visits += await ensureMonitoringVisit(geo, year, month, status, 2);
  return counts;
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅  DB connected\n");

    await syncStateOfficeTables(sequelize, {
      StateOffice,
      EnrolmentReport,
      StakeholderReport, StakeholderReportLine,
      EnrolmentDriveReport, EnrolmentDriveReportLine,
      ChallengesReport, ChallengesReportLine,
      WeeklyActionableReport, WeeklyActionableReportLine,
      ContractedServicesReport, ContractedServicesReportLine,
    });

    const states = await listCanonicalStates();
    if (!states.length) {
      console.error("❌  No states. Run: npm run db:seed-all (zones & states first)");
      process.exit(1);
    }

    const endYear = new Date().getFullYear();
    const endMonth = new Date().getMonth() + 1;
    const months = lastSixMonths(endYear, endMonth);

    console.log(`📊  Seeding role dashboard demo: ${states.length} states × ${months.length} months (${months[0].year}-${months[0].month} … ${endYear}-${endMonth})\n`);

    const totals = {
      enrolment: 0, weekly: 0, stakeholder: 0, drive: 0, challenges: 0, contracted: 0, visits: 0,
    };

    const KANO_STATE_ID = states.find((s) => s.code === "KAN" || /^kano$/i.test(String(s.description).trim()))?.id;

    for (let i = 0; i < states.length; i++) {
      const st = states[i];
      const profile = st.id === KANO_STATE_ID ? "medium" : i % 5 === 0 ? "weak" : i % 3 === 0 ? "medium" : "strong";
      const geo = {
        state_id: st.id,
        zone_id: st.zonal_id,
        label: st.description.replace(/\([^)]*\)/g, "").trim(),
      };

      for (const { year, month } of months) {
        const c = await seedStateMonth(geo, year, month, profile, endMonth);
        Object.keys(totals).forEach((k) => { totals[k] += c[k]; });
      }

      if (i < 8 || profile === "weak") {
        console.log(`  • ${geo.label} (${profile})`);
      }
    }

    if (states.length > 8) console.log(`  … and ${states.length - 8} more states`);

    console.log("\n✅  Role dashboard demo seed complete (new DASH-* rows only):");
    console.log(`   Enrolment headers:     +${totals.enrolment}`);
    console.log(`   Weekly actionable:     +${totals.weekly}`);
    console.log(`   Stakeholder (plan):    +${totals.stakeholder}`);
    console.log(`   Enrolment drives:      +${totals.drive}`);
    console.log(`   Challenges (+ lines):  +${totals.challenges}`);
    console.log(`   Contracted services:   +${totals.contracted}`);
    console.log(`   Monitoring visits:     +${totals.visits}`);
    console.log("\n   Refresh SC / Zonal / SDO / DG dashboards (filter: current year & month).\n");
    process.exit(0);
  } catch (err) {
    console.error("❌  Seed failed:", err.message);
    console.error(err);
    process.exit(1);
  }
})();
