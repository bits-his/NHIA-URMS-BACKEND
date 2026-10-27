const { defineReportStore, retiredModel } = require("../services/submissionStore");

function pair(reportType) {
  return defineReportStore(reportType);
}

const enrolment = pair("enrolment");
const migration = pair("migration");
const cemonc = pair("cemonc");
const accreditation = pair("accreditation");
const stakeholder = pair("stakeholder");
const enrolmentDrive = pair("enrolment-drive");
const hmoSelection = pair("hmo-selection");
const challenges = pair("challenges");
const complaintsCompliance = pair("complaints-compliance");
const igr = pair("igr");
const sshia = pair("sshia-financial");
const expenditure = pair("expenditure-profile");
const weeklyActionable = pair("weekly-actionable");
const contracted = pair("contracted-services");
const ict = pair("ict-support");
const adhoc = pair("adhoc-assignment");
const enrollee = pair("enrollee-register");
const etmc = pair("etmc-tmc-action-point");
const extraDependant = pair("extra-dependant");
const hcpChange = pair("hcf-change");
const weeklyCompliance = pair("weekly-compliance");
const mystery = pair("mystery-shopping");
const hmoIndebtedness = pair("hmo-indebtedness");
const hmoRecon = pair("hmo-recon");
const hmoMaster = pair("hmo-master");
const reconciliation = pair("reconciliation-meeting");
const stateComplaint = pair("state-complaint");
const complianceVisit = pair("compliance-visit");
const financeMonthly = pair("finance-monthly");
const programmesMonthly = pair("programmes-monthly");
const sqaMonthly = pair("sqa-monthly");
const visits = pair("monitoring-visit");
const surveys = pair("satisfaction-survey");
const commentCards = pair("comment-card");

module.exports = {
  EnrolmentReport: enrolment.Report,
  EnrolmentReportLine: enrolment.Line,
  MigrationReport: migration.Report,
  MigrationReportLine: migration.Line,
  CemoncReport: cemonc.Report,
  CemoncReportLine: cemonc.Line,
  AccreditationReport: accreditation.Report,
  AccreditationReportLine: accreditation.Line,
  StakeholderReport: stakeholder.Report,
  StakeholderReportLine: stakeholder.Line,
  EnrolmentDriveReport: enrolmentDrive.Report,
  EnrolmentDriveReportLine: enrolmentDrive.Line,
  HmoSelectionReport: hmoSelection.Report,
  HmoSelectionReportLine: hmoSelection.Line,
  ChallengesReport: challenges.Report,
  ChallengesReportLine: challenges.Line,
  ComplaintsComplianceReport: complaintsCompliance.Report,
  ComplaintsComplianceLine: complaintsCompliance.Line,
  IgrReport: igr.Report,
  IgrReportLine: igr.Line,
  SshiaFinancialReport: sshia.Report,
  SshiaFinancialReportLine: sshia.Line,
  ExpenditureProfileReport: expenditure.Report,
  ExpenditureProfileReportLine: expenditure.Line,
  WeeklyActionableReport: weeklyActionable.Report,
  WeeklyActionableReportLine: weeklyActionable.Line,
  ContractedServicesReport: contracted.Report,
  ContractedServicesReportLine: contracted.Line,
  IctSupportReport: ict.Report,
  IctSupportReportLine: ict.Line,
  AdhocAssignmentReport: adhoc.Report,
  AdhocAssignmentReportLine: adhoc.Line,
  MonthlyEnrolleeRegister: enrollee.Report,
  EtmcTmcActionPointRegister: etmc.Report,
  EtmcTmcActionPointLine: etmc.Line,
  ExtraDependantReport: extraDependant.Report,
  ExtraDependantReportLine: extraDependant.Line,
  HcpChangeReport: hcpChange.Report,
  HcpChangeReportLine: hcpChange.Line,
  StateOfficeWeeklyCompliance: weeklyCompliance.Report,
  StateOfficeMysteryShopping: mystery.Report,
  StateOfficeHmoIndebtedness: hmoIndebtedness.Report,
  StateOfficeHmoIndebtednessLine: hmoIndebtedness.Line,
  StateOfficeHmoReconSheet: hmoRecon.Report,
  StateOfficeHmoReconLine: hmoRecon.Line,
  StateOfficeHmoMasterSheet: hmoMaster.Report,
  StateOfficeHmoMasterLine: hmoMaster.Line,
  StateOfficeReconciliationMeeting: reconciliation.Report,
  StateOfficeComplaint: stateComplaint.Report,
  StateOfficeComplianceVisit: complianceVisit.Report,
  FinanceMonthlyReport: financeMonthly.Report,
  ProgrammesMonthlyReport: programmesMonthly.Report,
  SqaMonthlyReport: sqaMonthly.Report,
  MonitoringVisit: visits.Report,
  MonitoringVisitLine: visits.Line,
  ServicomSatisfactionSurvey: surveys.Report,
  ServicomCommentCard: commentCards.Report,
  AdminHrReport: defineReportStore(null).Report,

  StockAsset: retiredModel("stock_assets"),
  StockVerification: retiredModel("stock_verifications"),
  StockVerificationItem: retiredModel("stock_verification_items"),
  GoodsReceiptNote: retiredModel("goods_receipt_notes"),
  AssetTransfer: retiredModel("asset_transfers"),
  SupplyVerification: retiredModel("supply_verifications"),
  AssetMaintenance: retiredModel("asset_maintenances"),
  AssetDisposal: retiredModel("asset_disposals"),
  StockConversion: retiredModel("stock_conversions"),
  ServicomAssessmentIndicator: retiredModel("servicom_assessment_indicators"),
  ServicomFacility: retiredModel("servicom_facilities"),
  ServicomAssessmentScore: retiredModel("servicom_assessment_scores"),
  ServicomKpiRecord: retiredModel("servicom_kpi_records"),
  ServicomFinding: retiredModel("servicom_findings"),
  ServicomRecommendation: retiredModel("servicom_recommendations"),
  ServicomEvidence: retiredModel("servicom_evidence_uploads"),
};
