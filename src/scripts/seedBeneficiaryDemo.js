/**
 * Seed demo Beneficiary Management rows (parent + documents).
 *   node src/scripts/seedBeneficiaryDemo.js
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { syncActiveSchema } = require("../models/active");
const {
  BeneficiaryManagementReport,
  EnrolmentReport,
  StateOffice,
} = require("../models");
const { replaceDocuments } = require("../utils/formDocuments");

async function dropLegacyBeneficiaryTables() {
  const qi = sequelize.getQueryInterface();
  const legacy = [
    "extra_dependant_report_lines",
    "extra_dependant_reports",
    "hcp_change_report_lines",
    "hcp_change_reports",
    "hmo_selection_report_lines",
    "hmo_selection_reports",
  ];
  for (const t of legacy) {
    try {
      await qi.dropTable(t);
      console.log(`Dropped legacy ${t}`);
    } catch (_) { /* */ }
  }
}

async function main() {
  await sequelize.authenticate();
  await dropLegacyBeneficiaryTables();
  console.log("Syncing active schema…");
  await syncActiveSchema({ alter: true });

  if (!BeneficiaryManagementReport) {
    throw new Error("Beneficiary models not loaded — ensure APPROVED_FORMS['beneficiary-management'] is set");
  }

  const state = await StateOffice.findOne({ order: [["code", "ASC"]] });
  if (!state) throw new Error("No state_offices — seed zones/states first");

  const enrolment = EnrolmentReport
    ? await EnrolmentReport.findOne({ order: [["reference_id", "ASC"]] })
    : null;

  const { FormDocument } = require("../models");
  if (FormDocument) {
    await FormDocument.destroy({
      where: {
        form_key: "beneficiary-management",
        report_reference_id: { [Op.like]: "BM%-DEMO-%" },
      },
    }).catch(() => {});
  }
  await BeneficiaryManagementReport.destroy({
    where: { reference_id: { [Op.like]: "BM%-DEMO-%" } },
  });

  const common = {
    zonal_code: state.zonal_code,
    state_code: state.code,
    reporting_year: 2026,
    reporting_month: 10,
    quarter: 4,
    submission_date: "2026-10-15",
    submitted_by: "Demo Seed",
    status: "submitted",
    endorsed: false,
  };

  await BeneficiaryManagementReport.create({
    reference_id: "BMEX-DEMO-00001",
    activity_type: "extra_dependant",
    request_kind: "extra",
    enrollee_name: "Adaobi Okeke",
    nhia_number: "NHIA-DEMO-1001",
    enrolment_reference_id: enrolment?.reference_id || null,
    program_name: "FSSHIP",
    dependant_entity: "child",
    relationship_kind: "child",
    request_date: "2026-10-01",
    activity_status: "pending",
    surname: "Okeke",
    first_name: "Chinedu",
    nin: "12345678901",
    hcf: "Demo General Hospital",
    hmo_name: "Demo HMO",
    ...common,
  });

  await BeneficiaryManagementReport.create({
    reference_id: "BMHC-DEMO-00001",
    activity_type: "hcp_change",
    change_entity_type: "hcp",
    enrollee_name: "Adaobi Okeke",
    nhia_number: "NHIA-DEMO-1001",
    enrolment_reference_id: enrolment?.reference_id || null,
    program_name: "FSSHIP",
    current_provider: "Old Clinic",
    new_provider: "New Clinic",
    reason_category: "Change of residence / relocation",
    met_criteria: "yes",
    record_date: "2026-10-05",
    activity_status: "pending",
    ...common,
  });

  await BeneficiaryManagementReport.create({
    reference_id: "BMMS-DEMO-00001",
    activity_type: "mda_hmo_selection",
    mda: "Federal Ministry of Demo",
    selection_date: "2026-10-08",
    former_hmo: "Former HMO Ltd",
    selected_hmo: "Selected HMO Ltd",
    reason_for_change: "Contract cycle renewal",
    hmos_invited: 5,
    hmos_attended: 4,
    hmos_in_attendance: "HMO A, HMO B, HMO C, Selected HMO Ltd",
    compliance_guideline: "yes",
    transparent_process: "yes",
    activity_status: "completed",
    ...common,
  });

  await replaceDocuments("beneficiary-management", "BMEX-DEMO-00001", [
    {
      doc_kind: "supporting",
      name: "birth-certificate.pdf",
      path: "/uploads/beneficiary/demo-birth-certificate.pdf",
    },
  ]);

  const count = await BeneficiaryManagementReport.count({
    where: { reference_id: { [Op.like]: "BM%-DEMO-%" } },
  });
  console.log(`Seeded ${count} beneficiary rows for state ${state.code}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
