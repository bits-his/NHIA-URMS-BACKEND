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

// ── User ↔ Role (by key) ──────────────────────────────────────────────────────
User.belongsTo(Role, { foreignKey: "role", targetKey: "key", as: "roleRecord", constraints: false });

module.exports = {
  AnnualReport, QuarterlyData,
  ZonalOffice, StateOffice, Department, Unit, User, Role,
  StockAsset, StockVerification, StockVerificationItem,
  FinanceMonthlyReport, ProgrammesMonthlyReport, SqaMonthlyReport,
};
