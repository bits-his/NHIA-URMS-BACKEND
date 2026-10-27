const ZonalOffice = require("../ZonalOffice");
const StateOffice = require("../StateOffice");
const { makeProviderReportModels } = require("./makeProviderReportModels");

const accreditation = makeProviderReportModels({
  modelPrefix: "ProviderAccreditation",
  tablePrefix: "provider_accreditation",
});

const reaccreditation = makeProviderReportModels({
  modelPrefix: "ProviderReaccreditation",
  tablePrefix: "provider_reaccreditation",
});

const medicalAudits = makeProviderReportModels({
  modelPrefix: "ProviderMedicalAudit",
  tablePrefix: "provider_medical_audit",
});

const qaInspections = makeProviderReportModels({
  modelPrefix: "ProviderQaInspection",
  tablePrefix: "provider_qa_inspection",
});

const packs = [accreditation, reaccreditation, medicalAudits, qaInspections];

for (const { Report } of packs) {
  ZonalOffice.hasMany(Report, { foreignKey: "zone_id", as: `${Report.tableName}_zone` });
  Report.belongsTo(ZonalOffice, { foreignKey: "zone_id", as: "zone" });
  StateOffice.hasMany(Report, { foreignKey: "state_id", as: `${Report.tableName}_state` });
  Report.belongsTo(StateOffice, { foreignKey: "state_id", as: "state" });
}

module.exports = {
  ProviderAccreditationReport: accreditation.Report,
  ProviderAccreditationReportLine: accreditation.Line,
  ProviderReaccreditationReport: reaccreditation.Report,
  ProviderReaccreditationReportLine: reaccreditation.Line,
  ProviderMedicalAuditReport: medicalAudits.Report,
  ProviderMedicalAuditReportLine: medicalAudits.Line,
  ProviderQaInspectionReport: qaInspections.Report,
  ProviderQaInspectionReportLine: qaInspections.Line,
  PROVIDER_REPORT_PACKS: packs,
};
