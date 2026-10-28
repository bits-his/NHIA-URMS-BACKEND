/**
 * Provider Management form types — keep in sync with FE providerManagementTypes.ts
 */

const FORM_TYPES = [
  { key: "accreditation", prefix: "PACC", code: "PM-0001", category: "Accreditation", segment: "provider-accreditation" },
  { key: "reaccreditation", prefix: "PREC", code: "PM-0002", category: "Re-accreditation", segment: "provider-reaccreditation" },
  { key: "qa-inspections", prefix: "PQA", code: "PM-0003", category: "Quality Assurance", segment: "provider-qa-inspections" },
  { key: "medical-audits", prefix: "PMED", code: "PM-0004", category: "Medical Audit", segment: "provider-medical-audits" },
];

const SEGMENT_TO_FORM = Object.fromEntries(FORM_TYPES.map((t) => [t.segment, t.key]));
SEGMENT_TO_FORM.accreditation = "accreditation"; // legacy alias

const METRIC_LABEL_TO_COLUMN = {
  "Number of Applications Received (Accreditation)": "applications_received",
  "Number of Accreditation Forms Sold": "forms_sold",
  "Number of Completed/Returned Forms": "completed_forms_returned",
  "Number of Facilities Awaiting Accreditation": "awaiting_accreditation",
  "Number of Facilities Awaiting Re-accreditation": "awaiting_reaccreditation",
  "Number of PHCs Awaiting Accreditation": "phcs_awaiting_accreditation",
  "Number of PHCs Awaiting Re-accreditation": "phcs_awaiting_reaccreditation",
};

const COLUMN_TO_METRIC_LABEL = Object.fromEntries(
  Object.entries(METRIC_LABEL_TO_COLUMN).map(([k, v]) => [v, k]),
);

function metaFor(formType) {
  return FORM_TYPES.find((t) => t.key === formType) || FORM_TYPES[0];
}

function prefixFor(formType) {
  return metaFor(formType).prefix;
}

module.exports = {
  FORM_TYPES,
  SEGMENT_TO_FORM,
  METRIC_LABEL_TO_COLUMN,
  COLUMN_TO_METRIC_LABEL,
  metaFor,
  prefixFor,
};
