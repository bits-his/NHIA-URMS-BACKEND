const AnnualReport            = require("./AnnualReport");
const QuarterlyData           = require("./QuarterlyData");
const ZonalOffice             = require("./ZonalOffice");
const StateOffice             = require("./StateOffice");
const Department              = require("./Department");
const Unit                    = require("./Unit");
const { User }                = require("./User");
const Role                    = require("./Role");
const StockAsset              = require("./StockAsset");
const StockVerification       = require("./StockVerification");
const StockVerificationItem   = require("./StockVerificationItem");
const FinanceMonthlyReport    = require("./FinanceMonthlyReport");
const ProgrammesMonthlyReport = require("./ProgrammesMonthlyReport");
const SqaMonthlyReport        = require("./SqaMonthlyReport");
const ServicomAssessmentIndicator = require("./ServicomAssessmentIndicator");
const ServicomFacility            = require("./ServicomFacility");
const MonitoringVisit             = require("./MonitoringVisit");
const ServicomAssessmentScore     = require("./ServicomAssessmentScore");
const ServicomKpiRecord           = require("./ServicomKpiRecord");
const ServicomComplaint           = require("./ServicomComplaint");
const ServicomComplaintComment    = require("./ServicomComplaintComment");
const ComplaintSlaRule            = require("./ComplaintSlaRule");
const ServicomFinding             = require("./ServicomFinding");
const ServicomRecommendation      = require("./ServicomRecommendation");
const ServicomEvidence            = require("./ServicomEvidence");
const ServicomAuditLog            = require("./ServicomAuditLog");
const ServicomSatisfactionSurvey  = require("./ServicomSatisfactionSurvey");
const ServicomCommentCard         = require("./ServicomCommentCard");
const EnrolmentReport             = require("./EnrolmentReport");
const EnrolmentReportLine         = require("./EnrolmentReportLine");
const MigrationReport             = require("./MigrationReport");
const MigrationReportLine         = require("./MigrationReportLine");
const CemoncReport                = require("./CemoncReport");
const CemoncReportLine            = require("./CemoncReportLine");
const ComplaintsComplianceReport  = require("./ComplaintsComplianceReport");
require("./ComplaintsComplianceLines");
const AccreditationReport         = require("./AccreditationReport");
const AccreditationReportLine     = require("./AccreditationReportLine");
const StakeholderReport           = require("./StakeholderReport");
const StakeholderReportLine       = require("./StakeholderReportLine");
const HmoSelectionReport          = require("./HmoSelectionReport");
const HmoSelectionReportLine      = require("./HmoSelectionReportLine");
const ChallengesReport            = require("./ChallengesReport");
const StateOfficeComplaint        = require("./StateOfficeComplaint");
const StateOfficeComplianceVisit  = require("./StateOfficeComplianceVisit");
const StateOfficeMysteryShopping  = require("./StateOfficeMysteryShopping");
const StateOfficeHmoIndebtedness  = require("./StateOfficeHmoIndebtedness");
const StateOfficeHmoIndebtednessLine = require("./StateOfficeHmoIndebtednessLine");
const StateOfficeReconciliationMeeting = require("./StateOfficeReconciliationMeeting");
const NhiaAccreditedProvider          = require("./NhiaAccreditedProvider");
const HcfFacility                     = require("./HcfFacility");
const HmoProvider                     = require("./HmoProvider");
const IgrReport                   = require("./IgrReport");
const IgrReportLine               = require("./IgrReportLine");
const SshiaFinancialReport        = require("./SshiaFinancialReport");
const SshiaFinancialReportLine    = require("./SshiaFinancialReportLine");
const ExpenditureProfileReport    = require("./ExpenditureProfileReport");
const ExpenditureProfileReportLine = require("./ExpenditureProfileReportLine");
const WeeklyActionableReport       = require("./WeeklyActionableReport");
const WeeklyActionableReportLine   = require("./WeeklyActionableReportLine");
const ContractedServicesReport     = require("./ContractedServicesReport");
const ContractedServicesReportLine = require("./ContractedServicesReportLine");
const IctSupportReport             = require("./IctSupportReport");
const IctSupportReportLine         = require("./IctSupportReportLine");
const AdhocAssignmentReport        = require("./AdhocAssignmentReport");
const AdhocAssignmentReportLine    = require("./AdhocAssignmentReportLine");
const MonthlyEnrolleeRegister      = require("./MonthlyEnrolleeRegister");
const ExtraDependantReport         = require("./ExtraDependantReport");
const ExtraDependantReportLine     = require("./ExtraDependantReportLine");
const HcpChangeReport              = require("./HcpChangeReport");
const HcpChangeReportLine          = require("./HcpChangeReportLine");
const EtmcTmcActionPointRegister   = require("./EtmcTmcActionPointRegister");
const EtmcTmcActionPointLine       = require("./EtmcTmcActionPointLine");
const ComplianceReport            = require("./ComplianceReport");
const ComplianceFinding           = require("./ComplianceFinding");
const ComplianceViolation         = require("./ComplianceViolation");
const ComplianceEnforcementAction = require("./ComplianceEnforcementAction");
const StoreAsset                  = require("./StoreAsset");
const StoreInventoryItem          = require("./StoreInventoryItem");
const GoodsReceiptNote            = require("./GoodsReceiptNote");
const StockIssueVoucher           = require("./StockIssueVoucher");
const AssetTransfer               = require("./AssetTransfer");
const SupplyVerification          = require("./SupplyVerification");
const StateZonalOfficeProfile     = require("./StateZonalOfficeProfile");
const StateZonalFocalPerson       = require("./StateZonalFocalPerson");
const AssetMaintenance            = require("./AssetMaintenance");
const AssetDisposal               = require("./AssetDisposal");
const PhysicalAssetVerification   = require("./PhysicalAssetVerification");
const PhysicalAssetVerificationItem = require("./PhysicalAssetVerificationItem");
const StockConversion             = require("./StockConversion");
const PrepaymentAnalysis          = require("./PrepaymentAnalysis");
const AdminHrReport               = require("./AdminHrReport");

const bindStateOfficeReport = (Model, alias) => {
  ZonalOffice.hasMany(Model, { foreignKey: "zone_id", as: `${alias}_zone` });
  Model.belongsTo(ZonalOffice, { foreignKey: "zone_id", as: "zone" });
  StateOffice.hasMany(Model, { foreignKey: "state_id", as: `${alias}_state` });
  Model.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });
};

// ── Zone ↔ State ──────────────────────────────────────────────────────────────
ZonalOffice.hasMany(StateOffice,   { foreignKey: "zonal_id", as: "states" });
StateOffice.belongsTo(ZonalOffice, { foreignKey: "zonal_id", as: "zone"   });

// ── Department ↔ Unit ─────────────────────────────────────────────────────────
Department.hasMany(Unit,   { foreignKey: "department_id", as: "units"      });
Unit.belongsTo(Department, { foreignKey: "department_id", as: "department" });

// ── User ──────────────────────────────────────────────────────────────────────
User.belongsTo(ZonalOffice,  { foreignKey: "zone_id",       as: "zone"       });
User.belongsTo(StateOffice,  { foreignKey: "state_id",      as: "state"      });
User.belongsTo(Department,   { foreignKey: "department_id", as: "department" });
User.belongsTo(Unit,         { foreignKey: "unit_id",       as: "unit"       });
ZonalOffice.hasMany(User,    { foreignKey: "zone_id",       as: "users"      });
StateOffice.hasMany(User,    { foreignKey: "state_id",      as: "users"      });

// ── Stock assets ──────────────────────────────────────────────────────────────
StateOffice.hasMany(StockAsset,   { foreignKey: "state_id", as: "assets" });
StockAsset.belongsTo(StateOffice, { foreignKey: "state_id", as: "state"  });
Unit.hasMany(StockAsset,          { foreignKey: "unit_id",  as: "assets" });
StockAsset.belongsTo(Unit,        { foreignKey: "unit_id",  as: "unit"   });

// ── Stock verifications ───────────────────────────────────────────────────────
ZonalOffice.hasMany(StockVerification,   { foreignKey: "zone_id",       as: "sv_zone"       });
StockVerification.belongsTo(ZonalOffice, { foreignKey: "zone_id",       as: "zone"          });
StateOffice.hasMany(StockVerification,   { foreignKey: "state_id",      as: "sv_state"      });
StockVerification.belongsTo(StateOffice, { foreignKey: "state_id",      as: "state"         });
Department.hasMany(StockVerification,    { foreignKey: "department_id", as: "sv_dept"       });
StockVerification.belongsTo(Department,  { foreignKey: "department_id", as: "department"    });
Unit.hasMany(StockVerification,          { foreignKey: "unit_id",       as: "sv_unit"       });
StockVerification.belongsTo(Unit,        { foreignKey: "unit_id",       as: "unit"          });

// ── Monthly reports ───────────────────────────────────────────────────────────
StateOffice.hasMany(FinanceMonthlyReport,      { foreignKey: "state_id", as: "finance_reports"    });
FinanceMonthlyReport.belongsTo(StateOffice,    { foreignKey: "state_id", as: "state"              });

StateOffice.hasMany(ProgrammesMonthlyReport,   { foreignKey: "state_id", as: "programmes_reports" });
ProgrammesMonthlyReport.belongsTo(StateOffice, { foreignKey: "state_id", as: "state"              });

StateOffice.hasMany(SqaMonthlyReport,          { foreignKey: "state_id", as: "sqa_reports"        });
SqaMonthlyReport.belongsTo(StateOffice,        { foreignKey: "state_id", as: "state"              });

// ── State Office unified monthly reports ───────────────────────────────────────
ZonalOffice.hasMany(EnrolmentReport,   { foreignKey: "zone_id",  as: "enrolment_reports" });
EnrolmentReport.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"  });
StateOffice.hasMany(EnrolmentReport,   { foreignKey: "state_id", as: "enrolment_reports" });
EnrolmentReport.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(MigrationReport,   { foreignKey: "zone_id",  as: "migration_reports" });
MigrationReport.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"  });
StateOffice.hasMany(MigrationReport,   { foreignKey: "state_id", as: "migration_reports" });
MigrationReport.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(CemoncReport,   { foreignKey: "zone_id",  as: "cemonc_reports" });
CemoncReport.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"  });
StateOffice.hasMany(CemoncReport,   { foreignKey: "state_id", as: "cemonc_reports" });
CemoncReport.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

bindStateOfficeReport(ComplaintsComplianceReport, "complaints");
bindStateOfficeReport(AccreditationReport, "accreditation");
bindStateOfficeReport(StakeholderReport, "stakeholder");
bindStateOfficeReport(HmoSelectionReport, "hmo_selection");
bindStateOfficeReport(ChallengesReport, "challenges");

ZonalOffice.hasMany(StateOfficeComplaint, { foreignKey: "zone_id", as: "state_office_complaints" });
StateOfficeComplaint.belongsTo(ZonalOffice, { foreignKey: "zone_id", as: "zone" });
StateOffice.hasMany(StateOfficeComplaint, { foreignKey: "state_id", as: "state_office_complaints" });
StateOfficeComplaint.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(StateOfficeComplianceVisit, { foreignKey: "zone_id", as: "state_compliance_visits" });
StateOfficeComplianceVisit.belongsTo(ZonalOffice, { foreignKey: "zone_id", as: "zone" });
StateOffice.hasMany(StateOfficeComplianceVisit, { foreignKey: "state_id", as: "state_compliance_visits" });
StateOfficeComplianceVisit.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(StateOfficeMysteryShopping, { foreignKey: "zone_id", as: "state_mystery_shopping" });
StateOfficeMysteryShopping.belongsTo(ZonalOffice, { foreignKey: "zone_id", as: "zone" });
StateOffice.hasMany(StateOfficeMysteryShopping, { foreignKey: "state_id", as: "state_mystery_shopping" });
StateOfficeMysteryShopping.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(StateOfficeHmoIndebtedness, { foreignKey: "zone_id", as: "hmo_indebtedness" });
StateOfficeHmoIndebtedness.belongsTo(ZonalOffice, { foreignKey: "zone_id", as: "zone" });
StateOffice.hasMany(StateOfficeHmoIndebtedness, { foreignKey: "state_id", as: "hmo_indebtedness" });
StateOfficeHmoIndebtedness.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(StateOfficeReconciliationMeeting, { foreignKey: "zone_id", as: "state_reconciliation_meetings" });
StateOfficeReconciliationMeeting.belongsTo(ZonalOffice, { foreignKey: "zone_id", as: "zone" });
StateOffice.hasMany(StateOfficeReconciliationMeeting, { foreignKey: "state_id", as: "state_reconciliation_meetings" });
StateOfficeReconciliationMeeting.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });
ZonalOffice.hasMany(IgrReport,   { foreignKey: "zone_id",  as: "igr_reports" });
IgrReport.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"  });
StateOffice.hasMany(IgrReport,   { foreignKey: "state_id", as: "igr_reports" });
IgrReport.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(SshiaFinancialReport,   { foreignKey: "zone_id",  as: "sshia_financial_reports" });
SshiaFinancialReport.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"  });
StateOffice.hasMany(SshiaFinancialReport,   { foreignKey: "state_id", as: "sshia_financial_reports" });
SshiaFinancialReport.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(ExpenditureProfileReport,   { foreignKey: "zone_id",  as: "expenditure_profile_reports" });
ExpenditureProfileReport.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"  });
StateOffice.hasMany(ExpenditureProfileReport,   { foreignKey: "state_id", as: "expenditure_profile_reports" });
ExpenditureProfileReport.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(WeeklyActionableReport,   { foreignKey: "zone_id",  as: "weekly_actionable_reports" });
WeeklyActionableReport.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"  });
StateOffice.hasMany(WeeklyActionableReport,   { foreignKey: "state_id", as: "weekly_actionable_reports" });
WeeklyActionableReport.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(ContractedServicesReport,   { foreignKey: "zone_id",  as: "contracted_services_reports" });
ContractedServicesReport.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"  });
StateOffice.hasMany(ContractedServicesReport,   { foreignKey: "state_id", as: "contracted_services_reports" });
ContractedServicesReport.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(IctSupportReport,   { foreignKey: "zone_id",  as: "ict_support_reports" });
IctSupportReport.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"  });
StateOffice.hasMany(IctSupportReport,   { foreignKey: "state_id", as: "ict_support_reports" });
IctSupportReport.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(AdhocAssignmentReport,   { foreignKey: "zone_id",  as: "adhoc_assignment_reports" });
AdhocAssignmentReport.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"  });
StateOffice.hasMany(AdhocAssignmentReport,   { foreignKey: "state_id", as: "adhoc_assignment_reports" });
AdhocAssignmentReport.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(MonthlyEnrolleeRegister,   { foreignKey: "zone_id",  as: "monthly_enrollee_registers" });
MonthlyEnrolleeRegister.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"  });
StateOffice.hasMany(MonthlyEnrolleeRegister,   { foreignKey: "state_id", as: "monthly_enrollee_registers" });
MonthlyEnrolleeRegister.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(ExtraDependantReport,   { foreignKey: "zone_id",  as: "extra_dependant_reports" });
ExtraDependantReport.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"  });
StateOffice.hasMany(ExtraDependantReport,   { foreignKey: "state_id", as: "extra_dependant_reports" });
ExtraDependantReport.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(HcpChangeReport,   { foreignKey: "zone_id",  as: "hcp_change_reports" });
HcpChangeReport.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"  });
StateOffice.hasMany(HcpChangeReport,   { foreignKey: "state_id", as: "hcp_change_reports" });
HcpChangeReport.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(EtmcTmcActionPointRegister,   { foreignKey: "zone_id",  as: "etmc_tmc_action_point_registers" });
EtmcTmcActionPointRegister.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"  });
StateOffice.hasMany(EtmcTmcActionPointRegister,   { foreignKey: "state_id", as: "etmc_tmc_action_point_registers" });
EtmcTmcActionPointRegister.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

bindStateOfficeReport(ComplianceReport, "compliance");
bindStateOfficeReport(SupplyVerification, "supply_verification");
bindStateOfficeReport(StateZonalOfficeProfile, "office_profile");
bindStateOfficeReport(StateZonalFocalPerson, "focal_person");

// ── SERVICOM M&E ──────────────────────────────────────────────────────────────
ZonalOffice.hasMany(ServicomFacility,    { foreignKey: "zone_id",  as: "servicom_facilities" });
ServicomFacility.belongsTo(ZonalOffice,  { foreignKey: "zone_id",  as: "zone"                });
StateOffice.hasMany(ServicomFacility,    { foreignKey: "state_id", as: "servicom_facilities" });
ServicomFacility.belongsTo(StateOffice,  { foreignKey: "state_id", as: "state"               });

ZonalOffice.hasMany(MonitoringVisit,     { foreignKey: "zone_id",  as: "monitoring_visits"   });
MonitoringVisit.belongsTo(ZonalOffice,   { foreignKey: "zone_id",  as: "zone"                });
StateOffice.hasMany(MonitoringVisit,     { foreignKey: "state_id", as: "monitoring_visits"   });
MonitoringVisit.belongsTo(StateOffice,   { foreignKey: "state_id", as: "state"               });
ServicomFacility.hasMany(MonitoringVisit,{ foreignKey: "facility_id", as: "visits"           });
MonitoringVisit.belongsTo(ServicomFacility, { foreignKey: "facility_id", as: "facility"      });

MonitoringVisit.hasMany(ServicomAssessmentScore, { foreignKey: "visit_id", as: "scores" });
ServicomAssessmentScore.belongsTo(MonitoringVisit, { foreignKey: "visit_id", as: "visit" });
ServicomAssessmentIndicator.hasMany(ServicomAssessmentScore, { foreignKey: "indicator_id", as: "scores" });
ServicomAssessmentScore.belongsTo(ServicomAssessmentIndicator, { foreignKey: "indicator_id", as: "indicator" });

MonitoringVisit.hasOne(ServicomKpiRecord, { foreignKey: "visit_id", as: "kpi" });
ServicomKpiRecord.belongsTo(MonitoringVisit, { foreignKey: "visit_id", as: "visit" });

MonitoringVisit.hasMany(ServicomFinding, { foreignKey: "visit_id", as: "findings" });
ServicomFinding.belongsTo(MonitoringVisit, { foreignKey: "visit_id", as: "visit" });
MonitoringVisit.hasMany(ServicomRecommendation, { foreignKey: "visit_id", as: "recommendations" });
ServicomRecommendation.belongsTo(MonitoringVisit, { foreignKey: "visit_id", as: "visit" });
MonitoringVisit.hasMany(ServicomEvidence, { foreignKey: "visit_id", as: "evidence" });
ServicomEvidence.belongsTo(MonitoringVisit, { foreignKey: "visit_id", as: "visit" });

ZonalOffice.hasMany(ServicomComplaint,   { foreignKey: "zone_id",  as: "servicom_complaints" });
ServicomComplaint.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone"                });
StateOffice.hasMany(ServicomComplaint,   { foreignKey: "state_id", as: "servicom_complaints" });
ServicomComplaint.belongsTo(StateOffice, { foreignKey: "state_id", as: "state"               });
ServicomFacility.hasMany(ServicomComplaint, { foreignKey: "facility_id", as: "complaints"   });
ServicomComplaint.belongsTo(ServicomFacility, { foreignKey: "facility_id", as: "facility"  });
MonitoringVisit.hasMany(ServicomComplaint, { foreignKey: "visit_id", as: "complaints" });
ServicomComplaint.belongsTo(MonitoringVisit, { foreignKey: "visit_id", as: "visit" });
ServicomComplaint.hasMany(ServicomComplaintComment, { foreignKey: "complaint_id", as: "comments" });
ServicomComplaintComment.belongsTo(ServicomComplaint, { foreignKey: "complaint_id", as: "complaint" });

ZonalOffice.hasMany(ServicomSatisfactionSurvey,   { foreignKey: "zone_id",  as: "servicom_satisfaction_surveys" });
ServicomSatisfactionSurvey.belongsTo(ZonalOffice,  { foreignKey: "zone_id",  as: "zone" });
StateOffice.hasMany(ServicomSatisfactionSurvey,    { foreignKey: "state_id", as: "servicom_satisfaction_surveys" });
ServicomSatisfactionSurvey.belongsTo(StateOffice,  { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(ServicomCommentCard,   { foreignKey: "zone_id",  as: "servicom_comment_cards" });
ServicomCommentCard.belongsTo(ZonalOffice, { foreignKey: "zone_id",  as: "zone" });
StateOffice.hasMany(ServicomCommentCard,   { foreignKey: "state_id", as: "servicom_comment_cards" });
ServicomCommentCard.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

// ── Physical Asset Verification (Store Management) ────────────────────────────
PhysicalAssetVerification.hasMany(PhysicalAssetVerificationItem, {
  foreignKey: "verification_id",
  as: "items",
  onDelete: "CASCADE",
});
PhysicalAssetVerificationItem.belongsTo(PhysicalAssetVerification, {
  foreignKey: "verification_id",
  as: "verification",
});
PhysicalAssetVerificationItem.belongsTo(StoreAsset, {
  foreignKey: "assetId",
  as: "asset",
  constraints: false,
});

// ── User ↔ Role (by key) ──────────────────────────────────────────────────────
ZonalOffice.hasMany(HcfFacility, { foreignKey: "zone_id", as: "hcf_facilities" });
HcfFacility.belongsTo(ZonalOffice, { foreignKey: "zone_id", as: "zone" });
StateOffice.hasMany(HcfFacility, { foreignKey: "state_id", as: "hcf_facilities" });
HcfFacility.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

ZonalOffice.hasMany(AdminHrReport, { foreignKey: "zone_id", as: "admin_hr_reports" });
AdminHrReport.belongsTo(ZonalOffice, { foreignKey: "zone_id", as: "zone" });
StateOffice.hasMany(AdminHrReport, { foreignKey: "state_id", as: "admin_hr_reports" });
AdminHrReport.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });

module.exports = {
  AnnualReport, QuarterlyData,
  ZonalOffice, StateOffice, Department, Unit, User, Role,
  StockAsset, StockVerification, StockVerificationItem,
  FinanceMonthlyReport, ProgrammesMonthlyReport, SqaMonthlyReport,
  ServicomAssessmentIndicator, ServicomFacility, MonitoringVisit,
  ServicomAssessmentScore, ServicomKpiRecord, ServicomComplaint, ServicomComplaintComment, ComplaintSlaRule,
  ServicomFinding, ServicomRecommendation, ServicomEvidence, ServicomAuditLog,
  ServicomSatisfactionSurvey, ServicomCommentCard,
  EnrolmentReport, EnrolmentReportLine, MigrationReport, MigrationReportLine,
  CemoncReport, CemoncReportLine,
  ComplaintsComplianceReport, AccreditationReport, AccreditationReportLine,
  StakeholderReport, StakeholderReportLine, HmoSelectionReport, HmoSelectionReportLine,
  ChallengesReport,
  StateOfficeComplaint, StateOfficeComplianceVisit, StateOfficeMysteryShopping,
  StateOfficeHmoIndebtedness, StateOfficeHmoIndebtednessLine,
  StateOfficeReconciliationMeeting, NhiaAccreditedProvider, HcfFacility, HmoProvider,
  IgrReport, IgrReportLine,
  SshiaFinancialReport, SshiaFinancialReportLine,
  ExpenditureProfileReport, ExpenditureProfileReportLine,
  WeeklyActionableReport, WeeklyActionableReportLine,
  ContractedServicesReport, ContractedServicesReportLine,
  IctSupportReport, IctSupportReportLine,
  AdhocAssignmentReport, AdhocAssignmentReportLine,
  MonthlyEnrolleeRegister,
  ExtraDependantReport, ExtraDependantReportLine,
  HcpChangeReport, HcpChangeReportLine,
  EtmcTmcActionPointRegister, EtmcTmcActionPointLine,
  ComplianceReport, ComplianceFinding, ComplianceViolation, ComplianceEnforcementAction,
  StoreAsset, StoreInventoryItem, GoodsReceiptNote, StockIssueVoucher, AssetTransfer, SupplyVerification,
  StateZonalOfficeProfile, StateZonalFocalPerson, AssetMaintenance, AssetDisposal,
  PhysicalAssetVerification, PhysicalAssetVerificationItem, StockConversion, PrepaymentAnalysis,
  AdminHrReport,
};
