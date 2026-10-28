/**
 * Seed demo Provider Management rows + shared form_documents.
 * Drops legacy provider_* / accreditation_* packs when present.
 *   node src/scripts/seedProviderManagementDemo.js
 *   npm run db:seed-provider-pack
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { syncActiveSchema } = require("../models/active");
const {
  ProviderManagementReport,
  FormDocument,
  StateOffice,
} = require("../models");
const { replaceDocuments } = require("../utils/formDocuments");

async function dropLegacy() {
  const qi = sequelize.getQueryInterface();
  const tables = [
    "provider_accreditation_report_lines",
    "provider_accreditation_reports",
    "provider_reaccreditation_report_lines",
    "provider_reaccreditation_reports",
    "provider_medical_audit_report_lines",
    "provider_medical_audit_reports",
    "provider_qa_inspection_report_lines",
    "provider_qa_inspection_reports",
    "accreditation_report_lines",
    "accreditation_reports",
  ];
  for (const t of tables) {
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

  if (!ProviderManagementReport || !FormDocument) {
    throw new Error("Provider models not loaded — ensure APPROVED_FORMS['provider-management'] is set");
  }

  const state = await StateOffice.findOne({ order: [["code", "ASC"]] });
  if (!state) throw new Error("No state_offices — seed zones/states first");

  await FormDocument.destroy({
    where: {
      form_key: "provider-management",
      report_reference_id: { [Op.like]: "%-DEMO-%" },
    },
  });
  await ProviderManagementReport.destroy({
    where: { reference_id: { [Op.like]: "%-DEMO-%" } },
  });

  const common = {
    zonal_code: state.zonal_code,
    state_code: state.code,
    reporting_year: 2026,
    reporting_month: 10,
    quarter: 4,
    submission_date: "2026-10-20",
    submitted_by: "Demo Seed",
    status: "awaiting_review",
  };

  await ProviderManagementReport.create({
    reference_id: "PACC-DEMO-00001",
    form_type: "accreditation",
    engagement_code: "PM-0001",
    engagement_category: "Accreditation",
    related_programme: "FSSHIP",
    activity_date: "2026-10-08",
    total_facilities_in_state: 120,
    facilities_planned: 15,
    facilities_covered: 12,
    funding_option: "Routine",
    activity_status: "Completed",
    applications_received: 20,
    forms_sold: 18,
    completed_forms_returned: 15,
    awaiting_accreditation: 3,
    remarks: "Demo accreditation activity",
    ...common,
  });

  await replaceDocuments("provider-management", "PACC-DEMO-00001", [
    {
      doc_kind: "supporting",
      name: "accreditation-checklist.pdf",
      path: "/uploads/beneficiary/demo-provider-accreditation.pdf",
    },
  ]);

  await ProviderManagementReport.create({
    reference_id: "PREC-DEMO-00001",
    form_type: "reaccreditation",
    engagement_code: "PM-0002",
    engagement_category: "Re-accreditation",
    related_programme: "BHCPF",
    bhcpf_activity_type: "Reaccreditation",
    activity_date: "2026-10-12",
    total_facilities_in_state: 80,
    facilities_planned: 10,
    facilities_covered: 8,
    funding_option: "Funded (Budgetary)",
    activity_budget: 250000,
    approved_amount: 200000,
    activity_status: "In Progress",
    phcs_awaiting_reaccreditation: 5,
    ...common,
  });

  await ProviderManagementReport.create({
    reference_id: "PQA-DEMO-00001",
    form_type: "qa-inspections",
    engagement_code: "PM-0003",
    engagement_category: "Quality Assurance",
    related_programme: "FSSHIP",
    activity_date: "2026-10-15",
    total_facilities_in_state: 120,
    facilities_planned: 6,
    facilities_covered: 6,
    funding_option: "Routine",
    activity_status: "Completed",
    ...common,
  });

  await ProviderManagementReport.create({
    reference_id: "PMED-DEMO-00001",
    form_type: "medical-audits",
    engagement_code: "PM-0004",
    engagement_category: "Medical Audit",
    related_programme: "Other",
    activity_date: "2026-10-18",
    total_facilities_in_state: 40,
    facilities_planned: 4,
    facilities_covered: 3,
    funding_option: "Special/Ad-hoc Funded",
    activity_budget: 100000,
    approved_amount: 90000,
    activity_status: "Completed",
    ...common,
  });

  const count = await ProviderManagementReport.count({
    where: { reference_id: { [Op.like]: "%-DEMO-%" } },
  });
  console.log(`Seeded ${count} provider management rows for state ${state.code}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
