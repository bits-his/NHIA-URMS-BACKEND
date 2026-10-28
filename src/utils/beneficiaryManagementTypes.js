/**
 * Beneficiary Management activity types — keep in sync with FE beneficiaryManagementTypes.ts
 */

const ACTIVITY_TYPES = [
  { key: "additional_dependant", prefix: "BMAD", segment: "extra-dependant", requestKind: "additional" },
  { key: "extra_dependant", prefix: "BMEX", segment: "extra-dependant", requestKind: "extra" },
  { key: "hcp_change", prefix: "BMHC", segment: "hcf-change", changeEntity: "hcp" },
  { key: "hmo_change", prefix: "BMHM", segment: "hcf-change", changeEntity: "hmo" },
  { key: "mda_hmo_selection", prefix: "BMMS", segment: "hmo-selection" },
];

const SEGMENT_ACTIVITY_TYPES = {
  "extra-dependant": ["additional_dependant", "extra_dependant"],
  "hcf-change": ["hcp_change", "hmo_change"],
  "hmo-selection": ["mda_hmo_selection"],
};

const BENEFICIARY_SEGMENTS = Object.keys(SEGMENT_ACTIVITY_TYPES);

function prefixFor(activityType) {
  return ACTIVITY_TYPES.find((t) => t.key === activityType)?.prefix || "BMXX";
}

function resolveActivityType(segment, line = {}) {
  if (segment === "extra-dependant") {
    const kind = String(line.request_kind || line.request || "").toLowerCase();
    if (kind === "additional") return "additional_dependant";
    const program = String(line.program || line.program_name || "");
    if (program.endsWith("|additional")) return "additional_dependant";
    const rel = String(line.relationship || line.dependant_entity || "");
    if (/^child_[1-4]$/.test(rel)) return "additional_dependant";
    return "extra_dependant";
  }
  if (segment === "hcf-change") {
    const et = String(line.entity_type || line.change_entity_type || "hcp").toLowerCase();
    return et === "hmo" ? "hmo_change" : "hcp_change";
  }
  return "mda_hmo_selection";
}

module.exports = {
  ACTIVITY_TYPES,
  SEGMENT_ACTIVITY_TYPES,
  BENEFICIARY_SEGMENTS,
  prefixFor,
  resolveActivityType,
};
