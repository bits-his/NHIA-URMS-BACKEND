const AnnualReport = require("./AnnualReport");
const QuarterlyData = require("./QuarterlyData");
const ZonalOffice = require("./ZonalOffice");
const StateOffice = require("./StateOffice");
const Department = require("./Department");
const Unit = require("./Unit");
const { User } = require("./User");
const Role = require("./Role");
const AppNotification = require("./AppNotification");
const ServicomComplaint = require("./ServicomComplaint");
const ServicomComplaintComment = require("./ServicomComplaintComment");
const ComplaintSlaRule = require("./ComplaintSlaRule");
const ServicomAuditLog = require("./ServicomAuditLog");
const NhiaAccreditedProvider = require("./NhiaAccreditedProvider");
const HcfFacility = require("./HcfFacility");
const HmoProvider = require("./HmoProvider");
const ComplianceReport = require("./ComplianceReport");
const ComplianceFinding = require("./ComplianceFinding");
const ComplianceViolation = require("./ComplianceViolation");
const ComplianceEnforcementAction = require("./ComplianceEnforcementAction");
const StoreAsset = require("./StoreAsset");
const StoreInventoryItem = require("./StoreInventoryItem");
const StockIssueVoucher = require("./StockIssueVoucher");
const StateZonalOfficeProfile = require("./StateZonalOfficeProfile");
const StateZonalFocalPerson = require("./StateZonalFocalPerson");
const PhysicalAssetVerification = require("./PhysicalAssetVerification");
const PhysicalAssetVerificationItem = require("./PhysicalAssetVerificationItem");
const PrepaymentAnalysis = require("./PrepaymentAnalysis");
const Submission = require("./Submission");
const SubmissionLine = require("./SubmissionLine");
const SubmissionFile = require("./SubmissionFile");
const reportStores = require("./reportStores");

const bindOffice = (Model, alias) => {
  ZonalOffice.hasMany(Model, { foreignKey: "zone_id", as: `${alias}_zone` });
  Model.belongsTo(ZonalOffice, { foreignKey: "zone_id", as: "zone" });
  StateOffice.hasMany(Model, { foreignKey: "state_id", as: `${alias}_state` });
  Model.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });
};

ZonalOffice.hasMany(StateOffice, { foreignKey: "zonal_id", as: "states" });
StateOffice.belongsTo(ZonalOffice, { foreignKey: "zonal_id", as: "zone" });

Department.hasMany(Unit, { foreignKey: "department_id", as: "units" });
Unit.belongsTo(Department, { foreignKey: "department_id", as: "department" });

User.belongsTo(ZonalOffice, { foreignKey: "zone_id", as: "zone" });
User.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });
User.belongsTo(Department, { foreignKey: "department_id", as: "department" });
User.belongsTo(Unit, { foreignKey: "unit_id", as: "unit" });
ZonalOffice.hasMany(User, { foreignKey: "zone_id", as: "users" });
StateOffice.hasMany(User, { foreignKey: "state_id", as: "users" });

bindOffice(ComplianceReport, "compliance");
bindOffice(StateZonalOfficeProfile, "office_profile");
bindOffice(StateZonalFocalPerson, "focal_person");
bindOffice(HcfFacility, "hcf");
bindOffice(ServicomComplaint, "servicom_complaint");
bindOffice(Submission, "submission");

ServicomComplaint.hasMany(ServicomComplaintComment, { foreignKey: "complaint_id", as: "comments" });
ServicomComplaintComment.belongsTo(ServicomComplaint, { foreignKey: "complaint_id", as: "complaint" });

Submission.hasMany(SubmissionLine, { foreignKey: "submission_id", as: "lines", onDelete: "CASCADE" });
SubmissionLine.belongsTo(Submission, { foreignKey: "submission_id", as: "submission" });
Submission.hasMany(SubmissionFile, { foreignKey: "submission_id", as: "files", onDelete: "CASCADE" });
SubmissionFile.belongsTo(Submission, { foreignKey: "submission_id", as: "submission" });
SubmissionLine.hasMany(SubmissionFile, { foreignKey: "line_id", as: "files", onDelete: "SET NULL" });

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

module.exports = {
  AnnualReport, QuarterlyData,
  ZonalOffice, StateOffice, Department, Unit, User, Role, AppNotification,
  ServicomComplaint, ServicomComplaintComment, ComplaintSlaRule, ServicomAuditLog,
  NhiaAccreditedProvider, HcfFacility, HmoProvider,
  ComplianceReport, ComplianceFinding, ComplianceViolation, ComplianceEnforcementAction,
  StoreAsset, StoreInventoryItem, StockIssueVoucher,
  StateZonalOfficeProfile, StateZonalFocalPerson,
  PhysicalAssetVerification, PhysicalAssetVerificationItem, PrepaymentAnalysis,
  Submission, SubmissionLine, SubmissionFile,
  ...reportStores,
};
