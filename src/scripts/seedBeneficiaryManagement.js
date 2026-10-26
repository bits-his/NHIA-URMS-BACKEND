/**
 * Replaces Beneficiary Management sample data with five reports.
 */
require("dotenv").config();
const sequelize = require("../config/database");
require("../models/ExtraDependantReportLine");
require("../models/HcpChangeReportLine");
require("../models/HmoSelectionReportLine");
const ExtraDependantReport = require("../models/ExtraDependantReport");
const ExtraDependantReportLine = require("../models/ExtraDependantReportLine");
const HcpChangeReport = require("../models/HcpChangeReport");
const HcpChangeReportLine = require("../models/HcpChangeReportLine");
const HmoSelectionReport = require("../models/HmoSelectionReport");
const HmoSelectionReportLine = require("../models/HmoSelectionReportLine");

const identity = (person) => ([
  { field: "surname", value: person.surname },
  { field: "first_name", value: person.first },
  { field: "hmo", value: person.hmo },
  { field: "hcf", value: person.hcf },
  { field: "relationship", value: person.relationship },
]);

(async () => {
  await sequelize.authenticate();
  const t = await sequelize.transaction();
  try {
    await sequelize.query("DELETE FROM extra_dependant_report_lines", { transaction: t });
    await sequelize.query("DELETE FROM hcp_change_report_lines", { transaction: t });
    await sequelize.query("DELETE FROM hmo_selection_report_lines", { transaction: t });
    await sequelize.query("DELETE FROM extra_dependant_reports", { transaction: t });
    await sequelize.query("DELETE FROM hcp_change_reports", { transaction: t });
    await sequelize.query("DELETE FROM hmo_selection_reports", { transaction: t });

    const header = (reference_id, zone_id, state_id, month, status, submitted_by) => ({
      reference_id,
      zone_id,
      state_id,
      reporting_year: 2026,
      reporting_month: month,
      submission_date: status === "draft" ? null : "2026-06-12",
      submitted_by,
      status,
    });

    const additional = await ExtraDependantReport.create(
      header("BM-2026-001", 4, 2, 10, "draft", "Amina Bello"),
      { transaction: t },
    );
    await ExtraDependantReportLine.bulkCreate([
      {
        report_id: additional.id,
        enrollee_name: "Chinedu Okonkwo",
        principle_nhia_number: "NHIA-OY-10442",
        relationship: "spouse",
        program: "FSSHIP|additional",
        request_date: "2026-10-02",
        process_end_date: "2026-10-16",
        line_status: "pending",
        supporting_documents: identity({
          surname: "Okonkwo", first: "Chinedu", hmo: "Hygeia HMO", hcf: "UCH Ibadan", relationship: "spouse",
        }),
      },
      {
        report_id: additional.id,
        enrollee_name: "Chinedu Okonkwo",
        principle_nhia_number: "NHIA-OY-10442",
        relationship: "child_1",
        program: "FSSHIP|additional",
        request_date: "2026-10-02",
        process_end_date: "2026-10-16",
        line_status: "pending",
        supporting_documents: identity({
          surname: "Okonkwo", first: "Chinedu", hmo: "Hygeia HMO", hcf: "UCH Ibadan", relationship: "child",
        }),
      },
    ], { transaction: t });

    const extra = await ExtraDependantReport.create(
      header("BM-2026-002", 4, 60, 9, "submitted", "Tunde Adeyemi"),
      { transaction: t },
    );
    await ExtraDependantReportLine.create({
      report_id: extra.id,
      enrollee_name: "Fatima Lawal",
      principle_nhia_number: "NHIA-LG-22018",
      relationship: "parent",
      program: "FSSHIP|extra",
      request_date: "2026-09-08",
      process_end_date: "2026-09-22",
      line_status: "approved",
      supporting_documents: identity({
        surname: "Lawal", first: "Fatima", hmo: "AIICO Multishield", hcf: "Lagos Island General", relationship: "parent",
      }),
    }, { transaction: t });

    const hcp = await HcpChangeReport.create(
      header("BM-2026-003", 1, 8, 8, "approved", "Maryam Sule"),
      { transaction: t },
    );
    await HcpChangeReportLine.create({
      report_id: hcp.id,
      record_date: "2026-08-04",
      enrollee_name: "Ibrahim Musa",
      nhia_number: "NHIA-KD-33091",
      entity_type: "hcp",
      current_hcp_hmo: "Barau Dikko Teaching Hospital",
      new_hcp_hmo: "Yusuf Dantsoho Memorial Hospital",
      reason_for_transfer: "Change of residence / relocation",
      met_criteria: "yes",
      line_status: "approved",
      details: { program: "FSSHIP", mda: "" },
    }, { transaction: t });

    const hmo = await HcpChangeReport.create(
      header("BM-2026-004", 1, 14, 7, "submitted", "Hauwa Garba"),
      { transaction: t },
    );
    await HcpChangeReportLine.create({
      report_id: hmo.id,
      record_date: "2026-07-15",
      enrollee_name: "Aisha Danjuma",
      nhia_number: "NHIA-KN-11820",
      entity_type: "hmo",
      current_hcp_hmo: "Avon HMO",
      new_hcp_hmo: "Hygeia HMO",
      reason_for_transfer: "Poor HMO customer service or communication",
      met_criteria: "yes",
      line_status: "pending",
      details: { program: "GIFSHIP", mda: "Kano State Civil Service" },
    }, { transaction: t });

    const mda = await HmoSelectionReport.create(
      header("BM-2026-005", 3, 58, 6, "draft", "Grace Okeke"),
      { transaction: t },
    );
    await HmoSelectionReportLine.create({
      report_id: mda.id,
      selection_date: "2026-06-20",
      mda: "Federal Ministry of Health",
      former_hmo: "Reliance HMO",
      reason_for_change: "Employer directive after the annual review",
      hmos_invited: 5,
      hmos_attended: 4,
      hmos_in_attendance: "4",
      compliance_guideline: "yes",
      transparent_process: "yes",
      selected_hmo: "Leadway Health",
      details: { status: "pending", remarks: "Awaiting signed minutes" },
    }, { transaction: t });

    await t.commit();
    console.log("Seeded 5 beneficiary reports");
    process.exit(0);
  } catch (err) {
    await t.rollback();
    console.error(err);
    process.exit(1);
  }
})();
