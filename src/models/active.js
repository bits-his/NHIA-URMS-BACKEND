/**
 * Load ONLY core + approved-form models.
 * Legacy report models are NOT registered — so sync/boot cannot recreate them.
 */
const { CORE_TABLES, APPROVED_FORMS } = require("../config/activeSchema");

const ZonalOffice = require("./ZonalOffice");
const StateOffice = require("./StateOffice");
const Department = require("./Department");
const Unit = require("./Unit");
const { User } = require("./User");
const Role = require("./Role");
const AppNotification = require("./AppNotification");
const HmoProvider = require("./HmoProvider");
const HcfFacility = require("./HcfFacility");
const NhiaAccreditedProvider = require("./NhiaAccreditedProvider");

// Associations — org spine
ZonalOffice.hasMany(StateOffice, { foreignKey: "zonal_code", sourceKey: "zonal_code", as: "states" });
StateOffice.belongsTo(ZonalOffice, { foreignKey: "zonal_code", targetKey: "zonal_code", as: "zone" });
Department.hasMany(Unit, { foreignKey: "department_code", sourceKey: "department_code", as: "units" });
Unit.belongsTo(Department, { foreignKey: "department_code", targetKey: "department_code", as: "department" });
User.belongsTo(ZonalOffice, { foreignKey: "zonal_code", targetKey: "zonal_code", as: "zone" });
User.belongsTo(StateOffice, { foreignKey: "state_code", targetKey: "code", as: "state" });
User.belongsTo(Department, { foreignKey: "department_code", targetKey: "department_code", as: "department" });
User.belongsTo(Unit, { foreignKey: "unit_code", targetKey: "unit_code", as: "unit" });

ZonalOffice.hasMany(HcfFacility, { foreignKey: "zonal_code", sourceKey: "zonal_code", as: "hcf_facilities" });
HcfFacility.belongsTo(ZonalOffice, { foreignKey: "zonal_code", targetKey: "zonal_code", as: "zone" });
StateOffice.hasMany(HcfFacility, { foreignKey: "state_code", sourceKey: "code", as: "hcf_facilities" });
HcfFacility.belongsTo(StateOffice, { foreignKey: "state_code", targetKey: "code", as: "state" });

// Lookups / privileges only (no EAV form engine models)
const {
  Module,
  Feature,
  UserPrivilege,
  LookupDomain,
  LookupValue,
} = require("./redesign/core");

User.hasMany(UserPrivilege, { foreignKey: "user_id", as: "platform_privileges", onDelete: "CASCADE" });
UserPrivilege.belongsTo(User, { foreignKey: "user_id", as: "user" });

/** Models that must exist for login + reference data */
const CORE_MODELS = [
  ZonalOffice,
  StateOffice,
  Department,
  Unit,
  Role,
  User,
  AppNotification,
  HmoProvider,
  HcfFacility,
  NhiaAccreditedProvider,
  Module,
  Feature,
  UserPrivilege,
  LookupDomain,
  LookupValue,
];

/**
 * Form model loaders — only invoked when the form key is in APPROVED_FORMS.
 * Add a loader when a design is approved.
 */
const FORM_MODEL_LOADERS = {
  "comment-card": () => {
    const ServicomCommentCard = require("./ServicomCommentCard");
    const ServicomCommentCardResponse = require("./ServicomCommentCardResponse");

    ServicomCommentCard.hasMany(ServicomCommentCardResponse, {
      foreignKey: "reference_id",
      sourceKey: "reference_id",
      as: "responses",
      onDelete: "CASCADE",
    });
    ServicomCommentCardResponse.belongsTo(ServicomCommentCard, {
      foreignKey: "reference_id",
      targetKey: "reference_id",
      as: "card",
    });

    ZonalOffice.hasMany(ServicomCommentCard, {
      foreignKey: "zonal_code",
      sourceKey: "zonal_code",
      as: "comment_cards",
    });
    ServicomCommentCard.belongsTo(ZonalOffice, {
      foreignKey: "zonal_code",
      targetKey: "zonal_code",
      as: "zone",
    });

    StateOffice.hasMany(ServicomCommentCard, {
      foreignKey: "state_code",
      sourceKey: "code",
      as: "comment_cards",
    });
    ServicomCommentCard.belongsTo(StateOffice, {
      foreignKey: "state_code",
      targetKey: "code",
      as: "state",
    });

    Unit.hasMany(ServicomCommentCard, {
      foreignKey: "unit_code",
      sourceKey: "unit_code",
      as: "comment_cards",
    });
    ServicomCommentCard.belongsTo(Unit, {
      foreignKey: "unit_code",
      targetKey: "unit_code",
      as: "unit",
    });

    User.hasMany(ServicomCommentCard, {
      foreignKey: "created_by_user_id",
      as: "comment_cards",
    });
    ServicomCommentCard.belongsTo(User, {
      foreignKey: "created_by_user_id",
      as: "created_by_user",
    });

    return [ServicomCommentCard, ServicomCommentCardResponse];
  },

  "satisfaction-survey": () => {
    const ServicomSatisfactionSurvey = require("./ServicomSatisfactionSurvey");
    const ServicomSatisfactionSurveyResponse = require("./ServicomSatisfactionSurveyResponse");

    ServicomSatisfactionSurvey.hasMany(ServicomSatisfactionSurveyResponse, {
      foreignKey: "reference_id",
      sourceKey: "reference_id",
      as: "responses",
      onDelete: "CASCADE",
    });
    ServicomSatisfactionSurveyResponse.belongsTo(ServicomSatisfactionSurvey, {
      foreignKey: "reference_id",
      targetKey: "reference_id",
      as: "survey",
    });

    ZonalOffice.hasMany(ServicomSatisfactionSurvey, {
      foreignKey: "zonal_code",
      sourceKey: "zonal_code",
      as: "satisfaction_surveys",
    });
    ServicomSatisfactionSurvey.belongsTo(ZonalOffice, {
      foreignKey: "zonal_code",
      targetKey: "zonal_code",
      as: "zone",
    });

    StateOffice.hasMany(ServicomSatisfactionSurvey, {
      foreignKey: "state_code",
      sourceKey: "code",
      as: "satisfaction_surveys",
    });
    ServicomSatisfactionSurvey.belongsTo(StateOffice, {
      foreignKey: "state_code",
      targetKey: "code",
      as: "state",
    });

    Unit.hasMany(ServicomSatisfactionSurvey, {
      foreignKey: "unit_code",
      sourceKey: "unit_code",
      as: "satisfaction_surveys",
    });
    ServicomSatisfactionSurvey.belongsTo(Unit, {
      foreignKey: "unit_code",
      targetKey: "unit_code",
      as: "unit",
    });

    User.hasMany(ServicomSatisfactionSurvey, {
      foreignKey: "created_by_user_id",
      as: "satisfaction_surveys",
    });
    ServicomSatisfactionSurvey.belongsTo(User, {
      foreignKey: "created_by_user_id",
      as: "created_by_user",
    });

    return [ServicomSatisfactionSurvey, ServicomSatisfactionSurveyResponse];
  },

  enrolment: () => {
    const EnrolmentReport = require("./enrolment/EnrolmentReport");

    ZonalOffice.hasMany(EnrolmentReport, {
      foreignKey: "zonal_code",
      sourceKey: "zonal_code",
      as: "enrolment_reports",
    });
    EnrolmentReport.belongsTo(ZonalOffice, {
      foreignKey: "zonal_code",
      targetKey: "zonal_code",
      as: "zone",
    });
    StateOffice.hasMany(EnrolmentReport, {
      foreignKey: "state_code",
      sourceKey: "code",
      as: "enrolment_reports",
    });
    EnrolmentReport.belongsTo(StateOffice, {
      foreignKey: "state_code",
      targetKey: "code",
      as: "state",
    });
    Department.hasMany(EnrolmentReport, {
      foreignKey: "department_code",
      sourceKey: "department_code",
      as: "enrolment_reports",
    });
    EnrolmentReport.belongsTo(Department, {
      foreignKey: "department_code",
      targetKey: "department_code",
      as: "department",
    });
    Unit.hasMany(EnrolmentReport, {
      foreignKey: "unit_code",
      sourceKey: "unit_code",
      as: "enrolment_reports",
    });
    EnrolmentReport.belongsTo(Unit, {
      foreignKey: "unit_code",
      targetKey: "unit_code",
      as: "unit",
    });
    User.hasMany(EnrolmentReport, {
      foreignKey: "created_by_user_id",
      as: "enrolment_reports",
    });
    EnrolmentReport.belongsTo(User, {
      foreignKey: "created_by_user_id",
      as: "created_by_user",
    });

    return [EnrolmentReport];
  },

  "enrolment-drives": () => {
    const EnrolmentDriveReport = require("./enrolment/EnrolmentDriveReport");

    ZonalOffice.hasMany(EnrolmentDriveReport, {
      foreignKey: "zonal_code",
      sourceKey: "zonal_code",
      as: "enrolment_drive_reports",
    });
    EnrolmentDriveReport.belongsTo(ZonalOffice, {
      foreignKey: "zonal_code",
      targetKey: "zonal_code",
      as: "zone",
    });
    StateOffice.hasMany(EnrolmentDriveReport, {
      foreignKey: "state_code",
      sourceKey: "code",
      as: "enrolment_drive_reports",
    });
    EnrolmentDriveReport.belongsTo(StateOffice, {
      foreignKey: "state_code",
      targetKey: "code",
      as: "state",
    });
    Department.hasMany(EnrolmentDriveReport, {
      foreignKey: "department_code",
      sourceKey: "department_code",
      as: "enrolment_drive_reports",
    });
    EnrolmentDriveReport.belongsTo(Department, {
      foreignKey: "department_code",
      targetKey: "department_code",
      as: "department",
    });
    Unit.hasMany(EnrolmentDriveReport, {
      foreignKey: "unit_code",
      sourceKey: "unit_code",
      as: "enrolment_drive_reports",
    });
    EnrolmentDriveReport.belongsTo(Unit, {
      foreignKey: "unit_code",
      targetKey: "unit_code",
      as: "unit",
    });
    User.hasMany(EnrolmentDriveReport, {
      foreignKey: "created_by_user_id",
      as: "enrolment_drive_reports",
    });
    EnrolmentDriveReport.belongsTo(User, {
      foreignKey: "created_by_user_id",
      as: "created_by_user",
    });

    return [EnrolmentDriveReport];
  },

  "beneficiary-management": () => {
    const BeneficiaryManagementReport = require("./beneficiary/BeneficiaryManagementReport");
    const FormDocument = require("./shared/FormDocument");
    const EnrolmentReport = require("./enrolment/EnrolmentReport");

    ZonalOffice.hasMany(BeneficiaryManagementReport, {
      foreignKey: "zonal_code",
      sourceKey: "zonal_code",
      as: "beneficiary_management_reports",
    });
    BeneficiaryManagementReport.belongsTo(ZonalOffice, {
      foreignKey: "zonal_code",
      targetKey: "zonal_code",
      as: "zone",
    });
    StateOffice.hasMany(BeneficiaryManagementReport, {
      foreignKey: "state_code",
      sourceKey: "code",
      as: "beneficiary_management_reports",
    });
    BeneficiaryManagementReport.belongsTo(StateOffice, {
      foreignKey: "state_code",
      targetKey: "code",
      as: "state",
    });
    Department.hasMany(BeneficiaryManagementReport, {
      foreignKey: "department_code",
      sourceKey: "department_code",
      as: "beneficiary_management_reports",
    });
    BeneficiaryManagementReport.belongsTo(Department, {
      foreignKey: "department_code",
      targetKey: "department_code",
      as: "department",
    });
    Unit.hasMany(BeneficiaryManagementReport, {
      foreignKey: "unit_code",
      sourceKey: "unit_code",
      as: "beneficiary_management_reports",
    });
    BeneficiaryManagementReport.belongsTo(Unit, {
      foreignKey: "unit_code",
      targetKey: "unit_code",
      as: "unit",
    });
    User.hasMany(BeneficiaryManagementReport, {
      foreignKey: "created_by_user_id",
      as: "beneficiary_management_reports",
    });
    BeneficiaryManagementReport.belongsTo(User, {
      foreignKey: "created_by_user_id",
      as: "created_by_user",
    });
    EnrolmentReport.hasMany(BeneficiaryManagementReport, {
      foreignKey: "enrolment_reference_id",
      sourceKey: "reference_id",
      as: "beneficiary_management_reports",
    });
    BeneficiaryManagementReport.belongsTo(EnrolmentReport, {
      foreignKey: "enrolment_reference_id",
      targetKey: "reference_id",
      as: "enrolment",
    });

    return [BeneficiaryManagementReport, FormDocument];
  },

  "stakeholder-management": () => {
    const StakeholderReport = require("./stakeholder/StakeholderReport");
    const StakeholderOutcome = require("./stakeholder/StakeholderOutcome");
    const FormDocument = require("./shared/FormDocument");

    ZonalOffice.hasMany(StakeholderReport, {
      foreignKey: "zonal_code",
      sourceKey: "zonal_code",
      as: "stakeholder_reports",
    });
    StakeholderReport.belongsTo(ZonalOffice, {
      foreignKey: "zonal_code",
      targetKey: "zonal_code",
      as: "zone",
    });
    StateOffice.hasMany(StakeholderReport, {
      foreignKey: "state_code",
      sourceKey: "code",
      as: "stakeholder_reports",
    });
    StakeholderReport.belongsTo(StateOffice, {
      foreignKey: "state_code",
      targetKey: "code",
      as: "state",
    });
    Department.hasMany(StakeholderReport, {
      foreignKey: "department_code",
      sourceKey: "department_code",
      as: "stakeholder_reports",
    });
    StakeholderReport.belongsTo(Department, {
      foreignKey: "department_code",
      targetKey: "department_code",
      as: "department",
    });
    Unit.hasMany(StakeholderReport, {
      foreignKey: "unit_code",
      sourceKey: "unit_code",
      as: "stakeholder_reports",
    });
    StakeholderReport.belongsTo(Unit, {
      foreignKey: "unit_code",
      targetKey: "unit_code",
      as: "unit",
    });
    User.hasMany(StakeholderReport, {
      foreignKey: "created_by_user_id",
      as: "stakeholder_reports",
    });
    StakeholderReport.belongsTo(User, {
      foreignKey: "created_by_user_id",
      as: "created_by_user",
    });
    StakeholderReport.hasMany(StakeholderOutcome, {
      foreignKey: "report_reference_id",
      sourceKey: "reference_id",
      as: "outcomes",
      onDelete: "CASCADE",
    });
    StakeholderOutcome.belongsTo(StakeholderReport, {
      foreignKey: "report_reference_id",
      targetKey: "reference_id",
      as: "report",
    });

    return [StakeholderReport, StakeholderOutcome, FormDocument];
  },

  "provider-management": () => {
    const ProviderManagementReport = require("./provider/ProviderManagementReport");
    const FormDocument = require("./shared/FormDocument");

    ZonalOffice.hasMany(ProviderManagementReport, {
      foreignKey: "zonal_code",
      sourceKey: "zonal_code",
      as: "provider_management_reports",
    });
    ProviderManagementReport.belongsTo(ZonalOffice, {
      foreignKey: "zonal_code",
      targetKey: "zonal_code",
      as: "zone",
    });
    StateOffice.hasMany(ProviderManagementReport, {
      foreignKey: "state_code",
      sourceKey: "code",
      as: "provider_management_reports",
    });
    ProviderManagementReport.belongsTo(StateOffice, {
      foreignKey: "state_code",
      targetKey: "code",
      as: "state",
    });
    Department.hasMany(ProviderManagementReport, {
      foreignKey: "department_code",
      sourceKey: "department_code",
      as: "provider_management_reports",
    });
    ProviderManagementReport.belongsTo(Department, {
      foreignKey: "department_code",
      targetKey: "department_code",
      as: "department",
    });
    Unit.hasMany(ProviderManagementReport, {
      foreignKey: "unit_code",
      sourceKey: "unit_code",
      as: "provider_management_reports",
    });
    ProviderManagementReport.belongsTo(Unit, {
      foreignKey: "unit_code",
      targetKey: "unit_code",
      as: "unit",
    });
    User.hasMany(ProviderManagementReport, {
      foreignKey: "created_by_user_id",
      as: "provider_management_reports",
    });
    ProviderManagementReport.belongsTo(User, {
      foreignKey: "created_by_user_id",
      as: "created_by_user",
    });

    return [ProviderManagementReport, FormDocument];
  },

  "weekly-compliance": () => {
    const WeeklyComplianceReport = require("./weeklyCompliance/WeeklyComplianceReport");
    const WeeklyComplianceIndicator = require("./weeklyCompliance/WeeklyComplianceIndicator");

    ZonalOffice.hasMany(WeeklyComplianceReport, {
      foreignKey: "zonal_code",
      sourceKey: "zonal_code",
      as: "weekly_compliance_reports",
    });
    WeeklyComplianceReport.belongsTo(ZonalOffice, {
      foreignKey: "zonal_code",
      targetKey: "zonal_code",
      as: "zone",
    });
    StateOffice.hasMany(WeeklyComplianceReport, {
      foreignKey: "state_code",
      sourceKey: "code",
      as: "weekly_compliance_reports",
    });
    WeeklyComplianceReport.belongsTo(StateOffice, {
      foreignKey: "state_code",
      targetKey: "code",
      as: "state",
    });
    Department.hasMany(WeeklyComplianceReport, {
      foreignKey: "department_code",
      sourceKey: "department_code",
      as: "weekly_compliance_reports",
    });
    WeeklyComplianceReport.belongsTo(Department, {
      foreignKey: "department_code",
      targetKey: "department_code",
      as: "department",
    });
    Unit.hasMany(WeeklyComplianceReport, {
      foreignKey: "unit_code",
      sourceKey: "unit_code",
      as: "weekly_compliance_reports",
    });
    WeeklyComplianceReport.belongsTo(Unit, {
      foreignKey: "unit_code",
      targetKey: "unit_code",
      as: "unit",
    });
    User.hasMany(WeeklyComplianceReport, {
      foreignKey: "created_by_user_id",
      as: "weekly_compliance_reports",
    });
    WeeklyComplianceReport.belongsTo(User, {
      foreignKey: "created_by_user_id",
      as: "created_by_user",
    });
    WeeklyComplianceReport.hasMany(WeeklyComplianceIndicator, {
      foreignKey: "report_reference_id",
      sourceKey: "reference_id",
      as: "indicators",
      onDelete: "CASCADE",
    });
    WeeklyComplianceIndicator.belongsTo(WeeklyComplianceReport, {
      foreignKey: "report_reference_id",
      targetKey: "reference_id",
      as: "report",
    });

    return [WeeklyComplianceReport, WeeklyComplianceIndicator];
  },

  "hmo-indebtedness": () => {
    const HmoIndebtednessReport = require("./hmoIndebtedness/HmoIndebtednessReport");
    const HmoIndebtednessLine = require("./hmoIndebtedness/HmoIndebtednessLine");
    const HmoReconReport = require("./hmoIndebtedness/HmoReconReport");
    const HmoReconLine = require("./hmoIndebtedness/HmoReconLine");

    ZonalOffice.hasMany(HmoIndebtednessReport, {
      foreignKey: "zonal_code", sourceKey: "zonal_code", as: "hmo_indebtedness_reports",
    });
    HmoIndebtednessReport.belongsTo(ZonalOffice, {
      foreignKey: "zonal_code", targetKey: "zonal_code", as: "zone",
    });
    StateOffice.hasMany(HmoIndebtednessReport, {
      foreignKey: "state_code", sourceKey: "code", as: "hmo_indebtedness_reports",
    });
    HmoIndebtednessReport.belongsTo(StateOffice, {
      foreignKey: "state_code", targetKey: "code", as: "state",
    });
    Department.hasMany(HmoIndebtednessReport, {
      foreignKey: "department_code", sourceKey: "department_code", as: "hmo_indebtedness_reports",
    });
    HmoIndebtednessReport.belongsTo(Department, {
      foreignKey: "department_code", targetKey: "department_code", as: "department",
    });
    Unit.hasMany(HmoIndebtednessReport, {
      foreignKey: "unit_code", sourceKey: "unit_code", as: "hmo_indebtedness_reports",
    });
    HmoIndebtednessReport.belongsTo(Unit, {
      foreignKey: "unit_code", targetKey: "unit_code", as: "unit",
    });
    User.hasMany(HmoIndebtednessReport, {
      foreignKey: "created_by_user_id", as: "hmo_indebtedness_reports",
    });
    HmoIndebtednessReport.belongsTo(User, {
      foreignKey: "created_by_user_id", as: "created_by_user",
    });
    HmoIndebtednessReport.hasMany(HmoIndebtednessLine, {
      foreignKey: "report_reference_id", sourceKey: "reference_id", as: "lines", onDelete: "CASCADE",
    });
    HmoIndebtednessLine.belongsTo(HmoIndebtednessReport, {
      foreignKey: "report_reference_id", targetKey: "reference_id", as: "report",
    });

    ZonalOffice.hasMany(HmoReconReport, {
      foreignKey: "zonal_code", sourceKey: "zonal_code", as: "hmo_recon_reports",
    });
    HmoReconReport.belongsTo(ZonalOffice, {
      foreignKey: "zonal_code", targetKey: "zonal_code", as: "zone",
    });
    StateOffice.hasMany(HmoReconReport, {
      foreignKey: "state_code", sourceKey: "code", as: "hmo_recon_reports",
    });
    HmoReconReport.belongsTo(StateOffice, {
      foreignKey: "state_code", targetKey: "code", as: "state",
    });
    Department.hasMany(HmoReconReport, {
      foreignKey: "department_code", sourceKey: "department_code", as: "hmo_recon_reports",
    });
    HmoReconReport.belongsTo(Department, {
      foreignKey: "department_code", targetKey: "department_code", as: "department",
    });
    Unit.hasMany(HmoReconReport, {
      foreignKey: "unit_code", sourceKey: "unit_code", as: "hmo_recon_reports",
    });
    HmoReconReport.belongsTo(Unit, {
      foreignKey: "unit_code", targetKey: "unit_code", as: "unit",
    });
    User.hasMany(HmoReconReport, {
      foreignKey: "created_by_user_id", as: "hmo_recon_reports",
    });
    HmoReconReport.belongsTo(User, {
      foreignKey: "created_by_user_id", as: "created_by_user",
    });
    HmoReconReport.hasMany(HmoReconLine, {
      foreignKey: "report_reference_id", sourceKey: "reference_id", as: "lines", onDelete: "CASCADE",
    });
    HmoReconLine.belongsTo(HmoReconReport, {
      foreignKey: "report_reference_id", targetKey: "reference_id", as: "report",
    });

    return [HmoIndebtednessReport, HmoIndebtednessLine, HmoReconReport, HmoReconLine];
  },

  "store-management": () => {
    const StoreInventoryItem = require("./store/StoreInventoryItem");
    const StockMovement = require("./store/StockMovement");
    const StoreAsset = require("./store/StoreAsset");
    const PhysicalAssetVerification = require("./store/PhysicalAssetVerification");
    const PhysicalAssetVerificationItem = require("./store/PhysicalAssetVerificationItem");

    StoreInventoryItem.hasMany(StockMovement, {
      foreignKey: "item_code",
      sourceKey: "item_code",
      as: "movements",
    });
    StockMovement.belongsTo(StoreInventoryItem, {
      foreignKey: "item_code",
      targetKey: "item_code",
      as: "item",
    });

    ZonalOffice.hasMany(StoreInventoryItem, { foreignKey: "zonal_code", sourceKey: "zonal_code", as: "inventory_items" });
    StoreInventoryItem.belongsTo(ZonalOffice, { foreignKey: "zonal_code", targetKey: "zonal_code", as: "zone" });
    StateOffice.hasMany(StoreInventoryItem, { foreignKey: "state_code", sourceKey: "code", as: "inventory_items" });
    StoreInventoryItem.belongsTo(StateOffice, { foreignKey: "state_code", targetKey: "code", as: "state" });
    Department.hasMany(StoreInventoryItem, { foreignKey: "department_code", sourceKey: "department_code", as: "inventory_items" });
    StoreInventoryItem.belongsTo(Department, { foreignKey: "department_code", targetKey: "department_code", as: "department" });

    ZonalOffice.hasMany(StoreAsset, { foreignKey: "zonal_code", sourceKey: "zonal_code", as: "store_assets" });
    StoreAsset.belongsTo(ZonalOffice, { foreignKey: "zonal_code", targetKey: "zonal_code", as: "zone" });
    StateOffice.hasMany(StoreAsset, { foreignKey: "state_code", sourceKey: "code", as: "store_assets" });
    StoreAsset.belongsTo(StateOffice, { foreignKey: "state_code", targetKey: "code", as: "state" });
    Department.hasMany(StoreAsset, { foreignKey: "department_code", sourceKey: "department_code", as: "store_assets" });
    StoreAsset.belongsTo(Department, { foreignKey: "department_code", targetKey: "department_code", as: "department" });

    PhysicalAssetVerification.hasMany(PhysicalAssetVerificationItem, {
      foreignKey: "reference_no",
      sourceKey: "reference_no",
      as: "items",
      onDelete: "CASCADE",
    });
    PhysicalAssetVerificationItem.belongsTo(PhysicalAssetVerification, {
      foreignKey: "reference_no",
      targetKey: "reference_no",
      as: "verification",
    });
    PhysicalAssetVerificationItem.belongsTo(StoreAsset, {
      foreignKey: "asset_code",
      targetKey: "asset_code",
      as: "asset",
    });
    StoreAsset.hasMany(PhysicalAssetVerificationItem, {
      foreignKey: "asset_code",
      sourceKey: "asset_code",
      as: "verification_items",
    });

    ZonalOffice.hasMany(PhysicalAssetVerification, { foreignKey: "zonal_code", sourceKey: "zonal_code", as: "asset_verifications" });
    PhysicalAssetVerification.belongsTo(ZonalOffice, { foreignKey: "zonal_code", targetKey: "zonal_code", as: "zone" });
    StateOffice.hasMany(PhysicalAssetVerification, { foreignKey: "state_code", sourceKey: "code", as: "asset_verifications" });
    PhysicalAssetVerification.belongsTo(StateOffice, { foreignKey: "state_code", targetKey: "code", as: "state" });

    StockMovement.belongsTo(Department, {
      foreignKey: "receiving_department_code",
      targetKey: "department_code",
      as: "receiving_department",
    });

    return [
      StoreInventoryItem,
      StockMovement,
      StoreAsset,
      PhysicalAssetVerification,
      PhysicalAssetVerificationItem,
    ];
  },

  complaints: () => {
    const ServicomComplaint = require("./ServicomComplaint");
    const ServicomComplaintComment = require("./ServicomComplaintComment");

    ServicomComplaint.hasMany(ServicomComplaintComment, {
      foreignKey: "complaint_number",
      sourceKey: "complaint_number",
      as: "comments",
      onDelete: "CASCADE",
    });
    ServicomComplaintComment.belongsTo(ServicomComplaint, {
      foreignKey: "complaint_number",
      targetKey: "complaint_number",
      as: "complaint",
    });

    ZonalOffice.hasMany(ServicomComplaint, {
      foreignKey: "zonal_code",
      sourceKey: "zonal_code",
      as: "servicom_complaints",
    });
    ServicomComplaint.belongsTo(ZonalOffice, {
      foreignKey: "zonal_code",
      targetKey: "zonal_code",
      as: "zone",
    });

    StateOffice.hasMany(ServicomComplaint, {
      foreignKey: "state_code",
      sourceKey: "code",
      as: "servicom_complaints",
    });
    ServicomComplaint.belongsTo(StateOffice, {
      foreignKey: "state_code",
      targetKey: "code",
      as: "state",
    });

    Unit.hasMany(ServicomComplaint, {
      foreignKey: "unit_code",
      sourceKey: "unit_code",
      as: "servicom_complaints",
    });
    ServicomComplaint.belongsTo(Unit, {
      foreignKey: "unit_code",
      targetKey: "unit_code",
      as: "unit",
    });

    User.hasMany(ServicomComplaint, {
      foreignKey: "created_by_user_id",
      as: "servicom_complaints",
    });
    ServicomComplaint.belongsTo(User, {
      foreignKey: "created_by_user_id",
      as: "created_by_user",
    });

    User.hasMany(ServicomComplaintComment, {
      foreignKey: "created_by_user_id",
      as: "servicom_complaint_comments",
    });
    ServicomComplaintComment.belongsTo(User, {
      foreignKey: "created_by_user_id",
      as: "created_by_user",
    });

    HmoProvider.hasMany(ServicomComplaint, {
      foreignKey: "complainant_hmo_code",
      sourceKey: "hmo_code",
      as: "complainant_complaints",
    });
    ServicomComplaint.belongsTo(HmoProvider, {
      foreignKey: "complainant_hmo_code",
      targetKey: "hmo_code",
      as: "complainant_hmo",
    });
    HmoProvider.hasMany(ServicomComplaint, {
      foreignKey: "respondent_hmo_code",
      sourceKey: "hmo_code",
      as: "respondent_complaints",
    });
    ServicomComplaint.belongsTo(HmoProvider, {
      foreignKey: "respondent_hmo_code",
      targetKey: "hmo_code",
      as: "respondent_hmo",
    });

    return [ServicomComplaint, ServicomComplaintComment];
  },
};

let _approvedFormModelsCache = null;

function loadApprovedFormModels() {
  if (_approvedFormModelsCache) return _approvedFormModelsCache;
  const models = [];
  for (const key of Object.keys(APPROVED_FORMS)) {
    const loader = FORM_MODEL_LOADERS[key];
    if (!loader) {
      console.warn(`[activeSchema] No model loader for approved form "${key}"`);
      continue;
    }
    models.push(...loader());
  }
  _approvedFormModelsCache = models;
  return models;
}

function allActiveModels() {
  return [...CORE_MODELS, ...loadApprovedFormModels()];
}

async function syncActiveSchema({ alter = true } = {}) {
  const sequelize = require("../config/database");
  const seen = new Set();
  for (const model of allActiveModels()) {
    const name = model.tableName;
    if (seen.has(name)) continue;
    seen.add(name);
    await model.sync({ alter });
    console.log(`  synced ${name}`);
  }
  if (APPROVED_FORMS["hmo-indebtedness"]) {
    const { ensureHmoIndebtednessViews } = require("../utils/hmoIndebtednessViews");
    await ensureHmoIndebtednessViews(sequelize);
    console.log("  synced views hmo_indebtedness_facts_v, hmo_indebtedness_master_v");
  }
}

// Eager-load approved form models so associations + exports are available at boot
const approvedFormModels = loadApprovedFormModels();
const ServicomCommentCard = approvedFormModels.find((m) => m.tableName === "servicom_comment_cards") || null;
const ServicomCommentCardResponse =
  approvedFormModels.find((m) => m.tableName === "servicom_comment_card_responses") || null;
const ServicomSatisfactionSurvey =
  approvedFormModels.find((m) => m.tableName === "servicom_satisfaction_surveys") || null;
const ServicomSatisfactionSurveyResponse =
  approvedFormModels.find((m) => m.tableName === "servicom_satisfaction_survey_responses") || null;
const ServicomComplaint =
  approvedFormModels.find((m) => m.tableName === "servicom_complaints") || null;
const ServicomComplaintComment =
  approvedFormModels.find((m) => m.tableName === "servicom_complaint_comments") || null;
const StoreInventoryItem =
  approvedFormModels.find((m) => m.tableName === "store_inventory_items") || null;
const StockMovement =
  approvedFormModels.find((m) => m.tableName === "stock_movements") || null;
const StoreAsset =
  approvedFormModels.find((m) => m.tableName === "store_assets") || null;
const PhysicalAssetVerification =
  approvedFormModels.find((m) => m.tableName === "physical_asset_verifications") || null;
const PhysicalAssetVerificationItem =
  approvedFormModels.find((m) => m.tableName === "physical_asset_verification_items") || null;
const EnrolmentReport =
  approvedFormModels.find((m) => m.tableName === "enrolment_reports") || null;
const EnrolmentDriveReport =
  approvedFormModels.find((m) => m.tableName === "enrolment_drive_reports") || null;
const BeneficiaryManagementReport =
  approvedFormModels.find((m) => m.tableName === "beneficiary_management_reports") || null;
const StakeholderReport =
  approvedFormModels.find((m) => m.tableName === "stakeholder_reports") || null;
const StakeholderOutcome =
  approvedFormModels.find((m) => m.tableName === "stakeholder_outcomes") || null;
const ProviderManagementReport =
  approvedFormModels.find((m) => m.tableName === "provider_management_reports") || null;
const WeeklyComplianceReport =
  approvedFormModels.find((m) => m.tableName === "weekly_compliance_reports") || null;
const WeeklyComplianceIndicator =
  approvedFormModels.find((m) => m.tableName === "weekly_compliance_indicators") || null;
const HmoIndebtednessReport =
  approvedFormModels.find((m) => m.tableName === "hmo_indebtedness_reports") || null;
const HmoIndebtednessLine =
  approvedFormModels.find((m) => m.tableName === "hmo_indebtedness_lines") || null;
const HmoReconReport =
  approvedFormModels.find((m) => m.tableName === "hmo_recon_reports") || null;
const HmoReconLine =
  approvedFormModels.find((m) => m.tableName === "hmo_recon_lines") || null;
const FormDocument =
  approvedFormModels.find((m) => m.tableName === "form_documents") || null;

module.exports = {
  CORE_TABLES,
  APPROVED_FORMS,
  CORE_MODELS,
  FORM_MODEL_LOADERS,
  allActiveModels,
  syncActiveSchema,
  ZonalOffice,
  StateOffice,
  Department,
  Unit,
  User,
  Role,
  AppNotification,
  HmoProvider,
  HcfFacility,
  NhiaAccreditedProvider,
  Module,
  Feature,
  UserPrivilege,
  LookupDomain,
  LookupValue,
  ServicomCommentCard,
  ServicomCommentCardResponse,
  ServicomSatisfactionSurvey,
  ServicomSatisfactionSurveyResponse,
  ServicomComplaint,
  ServicomComplaintComment,
  StoreInventoryItem,
  StockMovement,
  StoreAsset,
  PhysicalAssetVerification,
  PhysicalAssetVerificationItem,
  EnrolmentReport,
  EnrolmentDriveReport,
  BeneficiaryManagementReport,
  StakeholderReport,
  StakeholderOutcome,
  ProviderManagementReport,
  WeeklyComplianceReport,
  WeeklyComplianceIndicator,
  HmoIndebtednessReport,
  HmoIndebtednessLine,
  HmoReconReport,
  HmoReconLine,
  FormDocument,
};
