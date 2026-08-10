/**
 * Seed default SERVICOM assessment indicators (idempotent).
 */
require("dotenv").config();
const sequelize = require("../config/database");
const ServicomAssessmentIndicator = require("../models/ServicomAssessmentIndicator");
const { logPartial } = require("../utils/seedUtils");

const DEFAULT_INDICATORS = [
  { key: "servicom_charter",              label: "Availability of SERVICOM Charter",              sort_order: 1 },
  { key: "service_standards",             label: "Visibility of Service Standards",             sort_order: 2 },
  { key: "waiting_time",                  label: "Patient Waiting Time Management",               sort_order: 3 },
  { key: "complaint_desk",                label: "Complaint Desk Availability",                 sort_order: 4 },
  { key: "complaint_resolution",          label: "Complaint Resolution Mechanism",              sort_order: 5 },
  { key: "staff_professionalism",         label: "Staff Professionalism",                         sort_order: 6 },
  { key: "timeliness",                    label: "Timeliness of Service Delivery",                sort_order: 7 },
  { key: "vulnerable_access",           label: "Accessibility for Vulnerable Groups",           sort_order: 8 },
  { key: "nhia_materials",                label: "Availability of NHIA Information Materials",    sort_order: 9 },
  { key: "client_satisfaction",           label: "Client Satisfaction",                           sort_order: 10 },
  { key: "data_management",               label: "Data Management",                               sort_order: 11 },
  { key: "nhia_guideline_compliance",     label: "NHIA Guideline Compliance",                     sort_order: 12 },
  { key: "record_availability",           label: "Record Availability",                           sort_order: 13 },
  { key: "complaint_responsiveness",      label: "Complaint Responsiveness",                      sort_order: 14 },
  { key: "continuous_improvement",        label: "Continuous Improvement Efforts",                sort_order: 15 },
];

(async () => {
  try {
    await sequelize.authenticate();

    let created = 0;
    let skipped = 0;
    for (const ind of DEFAULT_INDICATORS) {
      const [, wasCreated] = await ServicomAssessmentIndicator.findOrCreate({
        where: { key: ind.key },
        defaults: { ...ind, is_active: true },
      });
      if (wasCreated) created++;
      else skipped++;
    }
    logPartial("SERVICOM indicators", created, skipped);
    process.exit(0);
  } catch (err) {
    console.error("❌  Seed failed:", err.message);
    process.exit(1);
  }
})();
