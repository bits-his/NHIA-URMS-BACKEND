/**
 * Seed demo HMO Indebtedness collation + recon rows; create analysis views.
 * Drops legacy state_office_hmo_* tables.
 *
 *   npm run db:seed-hmo-indebtedness-pack
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { syncActiveSchema } = require("../models/active");
const {
  StateOffice,
  HmoIndebtednessReport,
  HmoIndebtednessLine,
  HmoReconReport,
  HmoReconLine,
  HmoProvider,
  HcfFacility,
} = require("../models");

async function dropLegacy() {
  const qi = sequelize.getQueryInterface();
  for (const t of [
    "state_office_hmo_indebtedness_lines",
    "state_office_hmo_indebtedness",
    "state_office_hmo_recon_lines",
    "state_office_hmo_recon_sheets",
    "state_office_hmo_master_lines",
    "state_office_hmo_master_sheets",
  ]) {
    try {
      await qi.dropTable(t);
      console.log(`Dropped ${t}`);
    } catch (_) { /* */ }
  }
}

async function main() {
  await sequelize.authenticate();
  await dropLegacy();
  console.log("Syncing active schema…");
  await syncActiveSchema({ alter: true });

  if (!HmoIndebtednessReport || !HmoReconReport) {
    throw new Error("HMO models not loaded — ensure APPROVED_FORMS['hmo-indebtedness'] is set");
  }

  const state = await StateOffice.findOne({ order: [["code", "ASC"]] });
  if (!state) throw new Error("No state_offices");

  await HmoIndebtednessLine.destroy({ where: { report_reference_id: { [Op.like]: "HID-DEMO-%" } } });
  await HmoIndebtednessReport.destroy({ where: { reference_id: { [Op.like]: "HID-DEMO-%" } } });
  await HmoReconLine.destroy({ where: { report_reference_id: { [Op.like]: "HR%-DEMO-%" } } });
  await HmoReconReport.destroy({ where: { reference_id: { [Op.like]: "HR%-DEMO-%" } } });

  const hmos = await HmoProvider.findAll({ limit: 2, order: [["hmo_code", "ASC"]] });
  const hcfs = await HcfFacility.findAll({
    where: state.code ? { state_code: state.code } : undefined,
    limit: 2,
    order: [["id", "ASC"]],
  });
  const hmo = hmos[0] || { name: "Demo HMO", hmo_code: "HMO-DEMO" };
  const hmo2 = hmos[1] || hmo;
  const hcf = hcfs[0] || { name: "Demo General Hospital", facility_code: "HCF-DEMO-1" };
  const hcf2 = hcfs[1] || { name: "Demo Clinic", facility_code: "HCF-DEMO-2" };

  const year = 2026;
  const month = 10;

  await HmoIndebtednessReport.create({
    reference_id: "HID-DEMO-00001",
    zonal_code: state.zonal_code,
    state_code: state.code,
    reporting_year: year,
    reporting_month: month,
    quarter: 4,
    submission_date: "2026-10-20",
    submitted_by: "Demo Seed",
    status: "submitted",
  });
  await HmoIndebtednessLine.bulkCreate([
    {
      report_reference_id: "HID-DEMO-00001",
      sn: 1,
      hmo_name: hmo.name || hmo.hmo_name || "Demo HMO",
      hmo_code: hmo.hmo_code || null,
      facility_name: hcf.name || hcf.facility_name || "Demo Facility",
      hcf_code: hcf.facility_code || hcf.accreditation_code || hcf.hcf_code || null,
      nhia_cap: 1200000,
      nhia_ffs: 450000,
      phi: 80000,
      total: 1730000,
    },
    {
      report_reference_id: "HID-DEMO-00001",
      sn: 2,
      hmo_name: hmo2.name || hmo2.hmo_name || "Demo HMO 2",
      hmo_code: hmo2.hmo_code || null,
      facility_name: hcf2.name || hcf2.facility_name || "Demo Facility 2",
      hcf_code: hcf2.facility_code || hcf2.accreditation_code || hcf2.hcf_code || null,
      nhia_cap: 900000,
      nhia_ffs: 200000,
      phi: 50000,
      total: 1150000,
    },
  ]);

  for (const [stream, ref, alleged, actual, agreed, paid] of [
    ["phi", "HRP-DEMO-00001", 80000, 75000, 70000, 40000],
    ["ffs", "HRF-DEMO-00001", 450000, 420000, 400000, 250000],
    ["cap", "HRC-DEMO-00001", 1200000, 1100000, 1050000, 800000],
  ]) {
    await HmoReconReport.create({
      reference_id: ref,
      stream_type: stream,
      zonal_code: state.zonal_code,
      state_code: state.code,
      reporting_year: year,
      reporting_month: month,
      quarter: 4,
      hmo_name: hmo.name || "Demo HMO",
      hmo_code: hmo.hmo_code || null,
      submission_date: "2026-10-22",
      submitted_by: "Demo Seed",
      status: "submitted",
    });
    await HmoReconLine.create({
      report_reference_id: ref,
      sn: 1,
      hcf_name: hcf.name || "Demo Facility",
      hcf_code: hcf.facility_code || hcf.accreditation_code || null,
      alleged_amount: alleged,
      actual_amount: actual,
      agreed_amount: agreed,
      amount_paid: paid,
      outstanding: agreed - paid,
      remarks: `Demo ${stream} recon`,
    });
  }

  console.log(`Seeded HMO indebtedness demo for state ${state.code}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
