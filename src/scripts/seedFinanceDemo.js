/**
 * Seed demo Finance pack rows for IGR, SSHIA, and Expenditure Profile.
 * Enough volume for list pages + Finance Dashboard (submitted KPIs).
 *
 *   node src/scripts/seedFinanceDemo.js
 *   npm run db:seed-finance-pack
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { syncActiveSchema } = require("../models/active");
const {
  FinanceIgrReport,
  FinanceSshiaReport,
  FinanceExpenditureProfile,
  StateOffice,
} = require("../models");

const YEAR = 2026;
const PREFIX = "FIN-DEMO";

const STATUSES = [
  "draft",
  "awaiting_review",
  "returned",
  "endorsed",
  "submitted",
  "submitted",
  "draft",
  "awaiting_review",
  "endorsed",
  "submitted",
  "returned",
  "submitted",
];

const IGR_SERVICES = [
  "gifship",
  "nin_charge",
  "enrollee_update",
  "application_accreditation",
  "extra_dependent",
  "additional_dependent",
  "change_of_hcf",
];

const PRINCIPALS = [
  "Aisha Bello",
  "Chinedu Okeke",
  "Fatima Musa",
  "Tunde Adeyemi",
  "Ngozi Eze",
  "Ibrahim Suleiman",
  "Grace Okafor",
  "Yusuf Danladi",
  "Halima Abdullahi",
  "Emeka Nwosu",
  "Amina Lawal",
  "Oluwaseun Balogun",
];

function pad(n, w = 2) {
  return String(n).padStart(w, "0");
}

function quarterFromMonth(month) {
  return Math.ceil(Number(month) / 3);
}

function monthForQuarter(q) {
  return (Number(q) - 1) * 3 + 1;
}

function reviewFields(status, i) {
  if (!["returned", "endorsed", "submitted"].includes(status)) {
    return {
      coordinator_review_note: null,
      coordinator_reviewed_by: null,
      coordinator_reviewed_at: null,
    };
  }
  return {
    coordinator_review_note:
      status === "returned"
        ? "Please correct the figures and resubmit."
        : "Reviewed and cleared for next step.",
    coordinator_reviewed_by: "State Coordinator (Demo)",
    coordinator_reviewed_at: new Date(`${YEAR}-${pad((i % 12) + 1)}-18T10:00:00Z`),
  };
}

/** Build 12 unique office+year+quarter slots across available states. */
function uniquePeriodSlots(states, count = 12) {
  const slots = [];
  const seen = new Set();
  let e = 0;
  while (slots.length < count && e < 200) {
    const state = states[e % states.length];
    const quarter = (e % 4) + 1;
    const year = YEAR - Math.floor(e / (states.length * 4));
    const key = `${state.zonal_code}|${state.code}|${year}|${quarter}`;
    e += 1;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({ state, quarter, year, month: monthForQuarter(quarter) });
  }
  return slots;
}

async function clearPeriodConflicts(Model, slots) {
  if (!slots.length) return;
  await Model.destroy({
    where: {
      [Op.or]: slots.map((s) => ({
        zonal_code: s.state.zonal_code,
        state_code: s.state.code,
        reporting_year: s.year,
        reporting_quarter: s.quarter,
      })),
    },
  });
}

async function main() {
  await sequelize.authenticate();
  console.log("Syncing active schema…");
  await syncActiveSchema({ alter: true });

  if (!FinanceIgrReport || !FinanceSshiaReport || !FinanceExpenditureProfile) {
    throw new Error("Finance models not loaded — check APPROVED_FORMS / active schema");
  }

  const states = await StateOffice.findAll({
    order: [["zonal_code", "ASC"], ["code", "ASC"]],
    limit: 16,
  });
  if (states.length < 4) {
    throw new Error("Need at least 4 state_offices — seed zones/states first");
  }

  await FinanceIgrReport.destroy({ where: { reference_id: { [Op.like]: `${PREFIX}-IGR-%` } } });
  await FinanceSshiaReport.destroy({ where: { reference_id: { [Op.like]: `${PREFIX}-SSHIA-%` } } });
  await FinanceExpenditureProfile.destroy({ where: { reference_id: { [Op.like]: `${PREFIX}-EXP-%` } } });

  // ── IGR: 12 receipt rows ──────────────────────────────────────────────────
  const igrRows = [];
  for (let i = 0; i < 12; i += 1) {
    const state = states[i % states.length];
    const month = (i % 12) + 1;
    const status = STATUSES[i];
    const amount = 15000 + i * 12500 + (i % 3) * 5000;
    const d = pad(Math.min(28, 5 + i));
    igrRows.push({
      reference_id: `${PREFIX}-IGR-${pad(i + 1, 3)}`,
      zonal_code: state.zonal_code,
      state_code: state.code,
      reporting_year: YEAR,
      reporting_month: month,
      quarter: quarterFromMonth(month),
      submission_date: status === "draft" ? null : `${YEAR}-${pad(month)}-${d}`,
      submitted_by: "Finance RO (Demo)",
      status,
      entry_date: `${YEAR}-${pad(month)}-${d}`,
      service_type: IGR_SERVICES[i % IGR_SERVICES.length],
      principal_name: PRINCIPALS[i],
      receipt_no: `RCP-${state.code}-${pad(i + 1, 3)}`,
      bill_rrr_no: `RRR-${state.code}-${pad(i + 1, 3)}`,
      nin_charge: IGR_SERVICES[i % IGR_SERVICES.length] === "nin_charge" ? 500 : 0,
      amount,
      payment_date: `${YEAR}-${pad(month)}-${d}`,
      remarks: i % 4 === 0 ? "Seeded demo receipt" : null,
      ...reviewFields(status, i),
    });
  }
  await FinanceIgrReport.bulkCreate(igrRows);

  // ── SSHIA: 12 quarterly office rows ───────────────────────────────────────
  const sshiaSlots = uniquePeriodSlots(states, 12);
  await clearPeriodConflicts(FinanceSshiaReport, sshiaSlots);
  const sshiaRows = sshiaSlots.map((slot, i) => {
    const status = STATUSES[i % STATUSES.length];
    const scale = 1 + (i % 5) * 0.15;
    return {
      reference_id: `${PREFIX}-SSHIA-${pad(i + 1, 3)}`,
      zonal_code: slot.state.zonal_code,
      state_code: slot.state.code,
      reporting_year: slot.year,
      reporting_month: slot.month,
      reporting_quarter: slot.quarter,
      submission_date: status === "draft" ? null : `${slot.year}-${pad(Math.min(12, slot.month + 2))}-20`,
      submitted_by: "Finance RO (Demo)",
      status,
      cap_opening_balance: Math.round(2500000 * scale),
      cap_receipts: Math.round(1800000 * scale),
      cap_actual_expenditure: Math.round(2100000 * scale),
      cap_bhcpf_lives: 12000 + i * 850,
      ffs_opening_balance: Math.round(800000 * scale),
      ffs_receipts: Math.round(650000 * scale),
      ffs_actual_expenditure: Math.round(700000 * scale),
      ffs_bhcpf_lives: 4000 + i * 200,
      reserve_opening_balance: Math.round(450000 * scale),
      reserve_receipts: Math.round(120000 * scale),
      reserve_actual_expenditure: Math.round(90000 * scale),
      reserve_bhcpf_lives: 500 + i * 40,
      admin_opening_balance: Math.round(180000 * scale),
      admin_receipts: Math.round(95000 * scale),
      admin_actual_expenditure: Math.round(110000 * scale),
      admin_bhcpf_lives: 200 + i * 15,
      remarks: "Seeded SSHIA progress demo",
      ...reviewFields(status, i),
    };
  });
  await FinanceSshiaReport.bulkCreate(sshiaRows);

  // ── Expenditure: 12 quarterly office rows ─────────────────────────────────
  const expSlots = uniquePeriodSlots(states, 12);
  await clearPeriodConflicts(FinanceExpenditureProfile, expSlots);
  const expRows = expSlots.map((slot, i) => {
    const status = STATUSES[i % STATUSES.length];
    const scale = 1 + (i % 6) * 0.1;
    return {
      reference_id: `${PREFIX}-EXP-${pad(i + 1, 3)}`,
      zonal_code: slot.state.zonal_code,
      state_code: slot.state.code,
      reporting_year: slot.year,
      reporting_month: slot.month,
      reporting_quarter: slot.quarter,
      submission_date: status === "draft" ? null : `${slot.year}-${pad(Math.min(12, slot.month + 2))}-22`,
      submitted_by: "Finance RO (Demo)",
      status,
      fuel_lubricants: Math.round(310000 * scale),
      newspapers_periodicals: Math.round(12000 * scale),
      entertainment_hospitality: Math.round(16000 * scale),
      telephone_postages: Math.round(45000 * scale),
      printing_stationery: Math.round(50000 * scale),
      transport_travel: Math.round(210000 * scale),
      maintenance_vehicles: Math.round(215000 * scale),
      maintenance_equipment: Math.round(71000 * scale),
      utilities_bank_charges: Math.round(74000 * scale),
      remarks: "Seeded expenditure profile demo",
      ...reviewFields(status, i),
    };
  });
  await FinanceExpenditureProfile.bulkCreate(expRows);

  console.log(`✅ Finance demo seed complete`);
  console.log(`   IGR receipts:              ${igrRows.length}`);
  console.log(`   SSHIA progress reports:    ${sshiaRows.length}`);
  console.log(`   Expenditure profiles:      ${expRows.length}`);
  console.log(`   Submitted rows feed the Finance Dashboard KPIs.`);
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
