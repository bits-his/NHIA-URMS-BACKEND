/**
 * Enrolment Drives (Monitoring Pillar 3) — one sidebar item / privilege per activity.
 * All share enrolment_drive_reports, separated by drive_type.
 * Keep in sync with urms-fronted/src/components/stateOffice/enrolmentDriveTypes.ts
 */
const CATEGORY_LABELS = {
  advocacy: ["Advocacy", "Courtesy Visit", "Others (Specify)"],
  "community-sensitization": ["Sensitization", "NYSC Sensitization", "Community Outreach", "Door-to-Door Campaign", "Others (Specify)"],
  "informal-sector": ["Informal Sector Mobilization", "Others (Specify)"],
  "enrolment-campaigns": ["Enrolment Campaigns", "Provider-based Enrolment", "Others (Specify)"],
  "market-religious": ["Market Association Outreach", "Religious Organisation Outreach", "Others (Specify)"],
  "mda-engagement": ["MDA Engagement", "OPS Engagement", "SPA Engagement", "Workplace Outreach", "Others (Specify)"],
  "capacity-building": ["Capacity Building", "Others (Specify)"],
  "media-parley": ["Media Parley/Campaign", "Others (Specify)"],
};
const ACTIVITY_CODES = { Sensitization: "E-001", "Media Parley/Campaign": "E-002", Advocacy: "E-003", "Informal Sector Mobilization": "E-004", "Enrolment Campaigns": "E-005", "Market Association Outreach": "E-006", "Religious Organisation Outreach": "E-007", "Courtesy Visit": "E-008", "NYSC Sensitization": "E-009", "Community Outreach": "E-010", "Door-to-Door Campaign": "E-011", "Workplace Outreach": "E-012", "Provider-based Enrolment": "E-013" };
const ENROLMENT_DRIVE_TYPES = [
  { key: "advocacy",                title: "Advocacy / Courtesy Visits",              prefix: "EDAC" },
  { key: "community-sensitization", title: "Community Sensitization",                 prefix: "EDCS" },
  { key: "informal-sector",         title: "Informal Sector Mobilization",            prefix: "EDIS" },
  { key: "enrolment-campaigns",     title: "Enrolment Campaigns",                     prefix: "EDEC" },
  { key: "market-religious",        title: "Market / Religious Organisation Outreach", prefix: "EDMR" },
  { key: "mda-engagement",          title: "MDAs / OPS / SPAs Engagement",            prefix: "EDMO" },
  { key: "capacity-building",       title: "Capacity Building",                       prefix: "EDCB" },
  { key: "media-parley",            title: "Media Parley / Campaigns",                prefix: "EDMP" },
].map((t) => ({ ...t, segment: `enrolment-drive-${t.key}`, categories: CATEGORY_LABELS[t.key].map((label) => ({ label, code: ACTIVITY_CODES[label] || "E-014" })) }));

module.exports = { ENROLMENT_DRIVE_TYPES };
