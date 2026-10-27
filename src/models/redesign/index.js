/**
 * Redesign platform models — sit beside legacy tables.
 * Org spine stays: zonal_offices, state_offices, users, roles.
 */
const Module = require("./Module");
const Feature = require("./Feature");
const UserPrivilege = require("./UserPrivilege");
const LookupDomain = require("./LookupDomain");
const LookupValue = require("./LookupValue");
const FormTemplate = require("./FormTemplate");
const FormTemplateVersion = require("./FormTemplateVersion");
const FormSection = require("./FormSection");
const FormField = require("./FormField");
const FormSubmission = require("./FormSubmission");
const FormAnswer = require("./FormAnswer");
const FormLineGroup = require("./FormLineGroup");
const FormLineAnswer = require("./FormLineAnswer");
const FormAttachment = require("./FormAttachment");
const WorkflowDefinition = require("./WorkflowDefinition");
const WorkflowTransition = require("./WorkflowTransition");
const SubmissionStatusEvent = require("./SubmissionStatusEvent");
const DimDate = require("./DimDate");
const DimGeography = require("./DimGeography");
const DimMetric = require("./DimMetric");
const DimForm = require("./DimForm");
const FactReportMetric = require("./FactReportMetric");

const { User } = require("../User");
const ZonalOffice = require("../ZonalOffice");
const StateOffice = require("../StateOffice");

// ── Privileges ───────────────────────────────────────────────────────────────
Module.hasMany(Feature, { foreignKey: "module_id", as: "features", onDelete: "CASCADE" });
Feature.belongsTo(Module, { foreignKey: "module_id", as: "module" });
Feature.hasMany(UserPrivilege, { foreignKey: "feature_id", as: "privileges", onDelete: "CASCADE" });
UserPrivilege.belongsTo(Feature, { foreignKey: "feature_id", as: "feature" });
User.hasMany(UserPrivilege, { foreignKey: "user_id", as: "platform_privileges", onDelete: "CASCADE" });
UserPrivilege.belongsTo(User, { foreignKey: "user_id", as: "user" });

// ── Lookups ──────────────────────────────────────────────────────────────────
LookupDomain.hasMany(LookupValue, { foreignKey: "domain_id", as: "values", onDelete: "CASCADE" });
LookupValue.belongsTo(LookupDomain, { foreignKey: "domain_id", as: "domain" });
LookupValue.belongsTo(LookupValue, { foreignKey: "parent_id", as: "parent" });

// ── Forms ────────────────────────────────────────────────────────────────────
Feature.hasMany(FormTemplate, { foreignKey: "feature_id", as: "form_templates" });
FormTemplate.belongsTo(Feature, { foreignKey: "feature_id", as: "feature" });
FormTemplate.hasMany(FormTemplateVersion, {
  foreignKey: "template_id",
  as: "versions",
  onDelete: "CASCADE",
});
FormTemplateVersion.belongsTo(FormTemplate, { foreignKey: "template_id", as: "template" });
FormTemplateVersion.hasMany(FormSection, {
  foreignKey: "version_id",
  as: "sections",
  onDelete: "CASCADE",
});
FormSection.belongsTo(FormTemplateVersion, { foreignKey: "version_id", as: "version" });
FormSection.hasMany(FormField, { foreignKey: "section_id", as: "fields", onDelete: "CASCADE" });
FormField.belongsTo(FormSection, { foreignKey: "section_id", as: "section" });
FormField.belongsTo(LookupDomain, { foreignKey: "lookup_domain_id", as: "lookup_domain" });

FormTemplate.hasMany(FormSubmission, { foreignKey: "template_id", as: "submissions" });
FormSubmission.belongsTo(FormTemplate, { foreignKey: "template_id", as: "template" });
FormSubmission.belongsTo(FormTemplateVersion, { foreignKey: "version_id", as: "version" });
FormSubmission.belongsTo(ZonalOffice, { foreignKey: "zone_id", as: "zone" });
FormSubmission.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });
FormSubmission.hasMany(FormAnswer, { foreignKey: "submission_id", as: "answers", onDelete: "CASCADE" });
FormAnswer.belongsTo(FormSubmission, { foreignKey: "submission_id", as: "submission" });
FormAnswer.belongsTo(FormField, { foreignKey: "field_id", as: "field" });
FormSubmission.hasMany(FormLineGroup, {
  foreignKey: "submission_id",
  as: "line_groups",
  onDelete: "CASCADE",
});
FormLineGroup.belongsTo(FormSubmission, { foreignKey: "submission_id", as: "submission" });
FormLineGroup.belongsTo(FormSection, { foreignKey: "section_id", as: "section" });
FormLineGroup.hasMany(FormLineAnswer, {
  foreignKey: "line_group_id",
  as: "answers",
  onDelete: "CASCADE",
});
FormLineAnswer.belongsTo(FormLineGroup, { foreignKey: "line_group_id", as: "line_group" });
FormLineAnswer.belongsTo(FormField, { foreignKey: "field_id", as: "field" });
FormSubmission.hasMany(FormAttachment, {
  foreignKey: "submission_id",
  as: "attachments",
  onDelete: "CASCADE",
});
FormSubmission.hasMany(SubmissionStatusEvent, {
  foreignKey: "submission_id",
  as: "status_events",
  onDelete: "CASCADE",
});
SubmissionStatusEvent.belongsTo(FormSubmission, { foreignKey: "submission_id", as: "submission" });

// ── Workflow ─────────────────────────────────────────────────────────────────
WorkflowDefinition.hasMany(WorkflowTransition, {
  foreignKey: "workflow_id",
  as: "transitions",
  onDelete: "CASCADE",
});
WorkflowTransition.belongsTo(WorkflowDefinition, { foreignKey: "workflow_id", as: "workflow" });

// ── Facts ────────────────────────────────────────────────────────────────────
FormSubmission.hasMany(FactReportMetric, {
  foreignKey: "submission_id",
  as: "facts",
  onDelete: "CASCADE",
});
FactReportMetric.belongsTo(FormSubmission, { foreignKey: "submission_id", as: "submission" });
FactReportMetric.belongsTo(DimDate, { foreignKey: "date_key", as: "date" });
FactReportMetric.belongsTo(DimGeography, { foreignKey: "geo_key", as: "geo" });
FactReportMetric.belongsTo(DimMetric, { foreignKey: "metric_key", as: "metric" });
FactReportMetric.belongsTo(DimForm, { foreignKey: "form_key", as: "form" });

module.exports = {
  Module,
  Feature,
  UserPrivilege,
  LookupDomain,
  LookupValue,
  FormTemplate,
  FormTemplateVersion,
  FormSection,
  FormField,
  FormSubmission,
  FormAnswer,
  FormLineGroup,
  FormLineAnswer,
  FormAttachment,
  WorkflowDefinition,
  WorkflowTransition,
  SubmissionStatusEvent,
  DimDate,
  DimGeography,
  DimMetric,
  DimForm,
  FactReportMetric,
};
