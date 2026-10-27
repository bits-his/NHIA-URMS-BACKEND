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
  for (const model of allActiveModels()) {
    await model.sync({ alter });
    console.log(`  synced ${model.tableName}`);
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
};
