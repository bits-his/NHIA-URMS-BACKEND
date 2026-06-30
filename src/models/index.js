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
const ServicomFinding             = require("./ServicomFinding");
const ServicomRecommendation      = require("./ServicomRecommendation");
const ServicomEvidence            = require("./ServicomEvidence");
const ServicomAuditLog            = require("./ServicomAuditLog");
const EnrolmentReport             = require("./EnrolmentReport");
const EnrolmentReportLine         = require("./EnrolmentReportLine");
const MigrationReport             = require("./MigrationReport");
const MigrationReportLine         = require("./MigrationReportLine");
const CemoncReport                = require("./CemoncReport");
const CemoncReportLine            = require("./CemoncReportLine");
const IgrReport                   = require("./IgrReport");
const IgrReportLine               = require("./IgrReportLine");
const SshiaFinancialReport        = require("./SshiaFinancialReport");
const SshiaFinancialReportLine    = require("./SshiaFinancialReportLine");
const ExpenditureProfileReport    = require("./ExpenditureProfileReport");
const ExpenditureProfileReportLine = require("./ExpenditureProfileReportLine");

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

// ── User ↔ Role (by key) ──────────────────────────────────────────────────────
User.belongsTo(Role, { foreignKey: "role", targetKey: "key", as: "roleRecord", constraints: false });

module.exports = {
  AnnualReport, QuarterlyData,
  ZonalOffice, StateOffice, Department, Unit, User, Role,
  StockAsset, StockVerification, StockVerificationItem,
  FinanceMonthlyReport, ProgrammesMonthlyReport, SqaMonthlyReport,
  ServicomAssessmentIndicator, ServicomFacility, MonitoringVisit,
  ServicomAssessmentScore, ServicomKpiRecord, ServicomComplaint,
  ServicomFinding, ServicomRecommendation, ServicomEvidence, ServicomAuditLog,
  EnrolmentReport, EnrolmentReportLine, MigrationReport, MigrationReportLine,
  CemoncReport, CemoncReportLine,
  IgrReport, IgrReportLine,
  SshiaFinancialReport, SshiaFinancialReportLine,
  ExpenditureProfileReport, ExpenditureProfileReportLine,
};
