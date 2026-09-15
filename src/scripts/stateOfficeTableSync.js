/**
 * Create-only sync for State Office tables (shared by migrate + seed scripts).
 */
require("../models/ComplaintsComplianceLines");

const SYNC_ORDER = (models) => [
  models.EnrolmentReport,
  models.EnrolmentReportLine,
  models.MigrationReport,
  models.MigrationReportLine,
  models.CemoncReport,
  models.CemoncReportLine,
  models.IgrReport,
  models.IgrReportLine,
  models.SshiaFinancialReport,
  models.SshiaFinancialReportLine,
  models.ExpenditureProfileReport,
  models.ExpenditureProfileReportLine,
  models.ComplaintsComplianceReport,
  models.AccreditationReport,
  models.AccreditationReportLine,
  models.StakeholderReport,
  models.StakeholderReportLine,
  models.HmoSelectionReport,
  models.HmoSelectionReportLine,
  models.ChallengesReport,
  models.WeeklyActionableReport,
  models.WeeklyActionableReportLine,
  models.ContractedServicesReport,
  models.ContractedServicesReportLine,
  models.IctSupportReport,
  models.IctSupportReportLine,
  models.AdhocAssignmentReport,
  models.AdhocAssignmentReportLine,
  models.StateOfficeComplaint,
  models.StateOfficeComplianceVisit,
  models.StateOfficeReconciliationMeeting,
  models.NhiaAccreditedProvider,
];

async function syncStateOfficeTables(sequelize, models, { log = false } = {}) {
  for (const Model of SYNC_ORDER(models)) {
    if (!Model) continue;
    await Model.sync();
    if (log) console.log(`  ✔  ${Model.tableName}`);
  }
  for (const name of [
    "ComplaintSummaryLine", "ComplaintStatusLine",
    "ComplianceVisitLine", "ReconciliationLine",
  ]) {
    const Model = sequelize.models[name];
    if (!Model) continue;
    await Model.sync();
    if (log) console.log(`  ✔  ${Model.tableName}`);
  }
}

module.exports = { syncStateOfficeTables };
