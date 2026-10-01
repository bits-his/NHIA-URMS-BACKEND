/**
 * Enrolment Drives (Monitoring Pillar 3) — one sidebar item / privilege per activity.
 * All share enrolment_drive_reports, separated by drive_type.
 * Keep in sync with urms-fronted/src/components/stateOffice/enrolmentDriveTypes.ts
 */
const ENROLMENT_DRIVE_TYPES = [
  { key: "advocacy",                title: "Advocacy / Courtesy Visits",              prefix: "EDAC" },
  { key: "community-sensitization", title: "Community Sensitization",                 prefix: "EDCS" },
  { key: "informal-sector",         title: "Informal Sector Mobilization",            prefix: "EDIS" },
  { key: "enrolment-campaigns",     title: "Enrolment Campaigns",                     prefix: "EDEC" },
  { key: "market-religious",        title: "Market / Religious Organisation Outreach", prefix: "EDMR" },
  { key: "mda-engagement",          title: "MDAs / OPS / SPAs Engagement",            prefix: "EDMO" },
  { key: "capacity-building",       title: "Capacity Building",                       prefix: "EDCB" },
  { key: "media-parley",            title: "Media Parley / Campaigns",                prefix: "EDMP" },
].map((t) => ({ ...t, segment: `enrolment-drive-${t.key}` }));

module.exports = { ENROLMENT_DRIVE_TYPES };
