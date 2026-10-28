/**
 * Active database surface during form-by-form reengineering.
 *
 * CORE  = always kept (login + reference / master data). Never dropped by purge.
 * FORMS = only tables for designs you have explicitly approved.
 *
 * Add a form here AFTER the design is approved — then sync + mount its routes.
 */

/** Tables that store login + org + master/reference data only */
const CORE_TABLES = [
  // Auth
  "users",
  "roles",
  // Org spine
  "zonal_offices",
  "state_offices",
  "departments",
  "units",
  // Master / reference lists (dropdown sources)
  "hmo_providers",
  "hcf_facilities",
  "nhia_accredited_providers",
  "lookup_domains",
  "lookup_values",
  // Access catalog (optional but useful with users)
  "modules",
  "features",
  "user_privileges",
  // In-app alerts
  "app_notifications",
];

/**
 * Approved form packs.
 * Empty until you approve a design. Example shape:
 *
 * "enrolment": {
 *   title: "Enrolment",
 *   tables: ["enrolment_reports"],
 *   routeSegment: "enrolment",
 * }
 */
const APPROVED_FORMS = {
  "comment-card": {
    title: "Citizens' Comment Card",
    tables: ["servicom_comment_cards", "servicom_comment_card_responses"],
    routeSegment: "comment-card",
  },
  "satisfaction-survey": {
    title: "HCF Customer Satisfaction Survey",
    tables: ["servicom_satisfaction_surveys", "servicom_satisfaction_survey_responses"],
    routeSegment: "satisfaction-survey",
  },
  complaints: {
    title: "Complaints Management",
    tables: ["servicom_complaints", "servicom_complaint_comments"],
    routeSegment: "complaints",
  },
  "store-management": {
    title: "Store Management / Physical Asset Verification",
    tables: [
      "store_inventory_items",
      "stock_movements",
      "store_assets",
      "physical_asset_verifications",
      "physical_asset_verification_items",
    ],
    routeSegment: "store-management",
  },
  enrolment: {
    title: "Enrolment Activity Reporting",
    tables: ["enrolment_reports"],
    routeSegment: "enrolment",
  },
  "enrolment-drives": {
    title: "Enrolment Drives",
    tables: ["enrolment_drive_reports"],
    routeSegment: "enrolment-drives",
  },
  "beneficiary-management": {
    title: "Beneficiary Management",
    tables: ["beneficiary_management_reports", "form_documents"],
    routeSegment: "beneficiary-management",
  },
  "stakeholder-management": {
    title: "Stakeholder Management",
    tables: ["stakeholder_reports", "stakeholder_outcomes", "form_documents"],
    routeSegment: "stakeholder",
  },
  "provider-management": {
    title: "Provider Management",
    tables: ["provider_management_reports", "form_documents"],
    routeSegment: "provider-management",
  },
  "weekly-compliance": {
    title: "Weekly Compliance Report",
    tables: ["weekly_compliance_reports", "weekly_compliance_indicators"],
    routeSegment: "weekly-compliance",
  },
  "hmo-indebtedness": {
    title: "HMO Indebtedness",
    tables: [
      "hmo_indebtedness_reports",
      "hmo_indebtedness_lines",
      "hmo_recon_reports",
      "hmo_recon_lines",
    ],
    routeSegment: "hmo-indebtedness",
  },
};

function approvedFormTables() {
  return Object.values(APPROVED_FORMS).flatMap((f) => f.tables || []);
}

function allowedTables() {
  return new Set([...CORE_TABLES, ...approvedFormTables()]);
}

function isTableAllowed(name) {
  return allowedTables().has(name);
}

module.exports = {
  CORE_TABLES,
  APPROVED_FORMS,
  approvedFormTables,
  allowedTables,
  isTableAllowed,
};
