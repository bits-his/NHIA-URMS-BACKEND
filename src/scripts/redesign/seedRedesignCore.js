/**
 * Seed modules, features, workflow, dims, Enrolment form template + lookups.
 * Idempotent (findOrCreate). Usage: npm run db:redesign:seed
 */
require("dotenv").config();
const sequelize = require("../../config/database");
require("../../models/index");
const {
  Module,
  Feature,
  LookupDomain,
  LookupValue,
  FormTemplate,
  FormTemplateVersion,
  FormSection,
  FormField,
  WorkflowDefinition,
  WorkflowTransition,
  DimMetric,
  DimForm,
  DimGeography,
  DimDate,
} = require("../../models/redesign");
const ZonalOffice = require("../../models/ZonalOffice");
const StateOffice = require("../../models/StateOffice");

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ENROLMENT_LOOKUP_DOMAINS = [
  { key_name: "enrolment_channel", label: "Enrolment Channel" },
  { key_name: "enrolment_type", label: "Enrolment Type" },
  { key_name: "enrolment_category", label: "Enrolment Category" },
  { key_name: "beneficiary_category", label: "Beneficiary Category" },
  { key_name: "beneficiary_status", label: "Beneficiary Status" },
  { key_name: "funding_option", label: "Funding Option" },
  { key_name: "activity_status", label: "Activity Status" },
  { key_name: "supporting_evidence", label: "Supporting Evidence" },
];

/** Fallback values if legacy table has no DISTINCT data yet */
const FALLBACK_LOOKUP_VALUES = {
  enrolment_channel: ["Online", "Offline", "Mobile Team", "Facility-based"],
  enrolment_type: ["New", "Renewal", "Reactivation"],
  enrolment_category: ["Formal", "Informal", "Vulnerable"],
  beneficiary_category: ["Principal", "Dependant", "Extra Dependant"],
  beneficiary_status: ["Active", "Pending", "Suspended"],
  funding_option: ["Government", "Donor", "Self", "Employer"],
  activity_status: ["Planned", "Ongoing", "Completed", "Cancelled"],
  supporting_evidence: ["ID Card", "NIN", "Photo", "Other"],
};

const ENROLMENT_LINE_FIELDS = [
  { key_name: "category", label: "Category", data_type: "text", is_required: true },
  { key_name: "activity_code", label: "Activity Code", data_type: "text" },
  { key_name: "activity_date", label: "Activity Date", data_type: "date" },
  { key_name: "enrolment_channel", label: "Enrolment Channel", data_type: "lookup", lookup: "enrolment_channel" },
  { key_name: "enrolment_type", label: "Enrolment Type", data_type: "lookup", lookup: "enrolment_type" },
  { key_name: "program_code", label: "Program Code", data_type: "text" },
  { key_name: "program_name", label: "Program Name", data_type: "text" },
  { key_name: "enrolment_category", label: "Enrolment Category", data_type: "lookup", lookup: "enrolment_category" },
  { key_name: "beneficiary_category", label: "Beneficiary Category", data_type: "lookup", lookup: "beneficiary_category" },
  { key_name: "beneficiary_status", label: "Beneficiary Status", data_type: "lookup", lookup: "beneficiary_status" },
  { key_name: "funding_option", label: "Funding Option", data_type: "lookup", lookup: "funding_option" },
  { key_name: "supporting_evidence", label: "Supporting Evidence", data_type: "lookup", lookup: "supporting_evidence" },
  { key_name: "status_reason", label: "Status Reason", data_type: "textarea" },
  {
    key_name: "activity_budget",
    label: "Activity Budget",
    data_type: "decimal",
    is_metric: true,
    metric_key: "activity_budget",
  },
  {
    key_name: "approved_amount",
    label: "Approved Amount",
    data_type: "decimal",
    is_metric: true,
    metric_key: "approved_amount",
  },
  {
    key_name: "enrolment_count",
    label: "Enrolment Count",
    data_type: "integer",
    is_required: true,
    is_metric: true,
    metric_key: "enrolment_count",
  },
  {
    key_name: "enrollees_validated",
    label: "Enrollees Validated",
    data_type: "integer",
    is_metric: true,
    metric_key: "enrollees_validated",
  },
  { key_name: "activity_status", label: "Activity Status", data_type: "lookup", lookup: "activity_status" },
  { key_name: "remarks", label: "Remarks", data_type: "textarea" },
  { key_name: "program_details", label: "Program Details", data_type: "json" },
  { key_name: "quarter", label: "Quarter", data_type: "integer" },
];

function slugCode(label) {
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80) || "unknown";
}

async function ensureDimDates(years) {
  for (const year of years) {
    for (let month = 1; month <= 12; month++) {
      const full = `${year}-${String(month).padStart(2, "0")}-01`;
      const dateKey = year * 10000 + month * 100 + 1;
      await DimDate.findOrCreate({
        where: { date_key: dateKey },
        defaults: {
          full_date: full,
          year_num: year,
          quarter_num: Math.ceil(month / 3),
          month_num: month,
          week_num: null,
          month_name: MONTH_NAMES[month],
        },
      });
    }
  }
}

async function seedLookupsFromLegacy() {
  const domainMap = {};
  for (const d of ENROLMENT_LOOKUP_DOMAINS) {
    const [row] = await LookupDomain.findOrCreate({
      where: { key_name: d.key_name },
      defaults: { ...d, is_system: true, is_active: true },
    });
    domainMap[d.key_name] = row;
  }

  // Pull DISTINCT labels from legacy enrolment lines when present
  let legacyCols = {};
  try {
    const [rows] = await sequelize.query(`
      SELECT
        enrolment_channel,
        enrolment_type,
        enrolment_category,
        beneficiary_category,
        beneficiary_status,
        funding_option,
        activity_status,
        supporting_evidence
      FROM enrolment_report_lines
      LIMIT 5000
    `);
    for (const r of rows) {
      for (const key of Object.keys(FALLBACK_LOOKUP_VALUES)) {
        const val = r[key];
        if (val == null || String(val).trim() === "") continue;
        if (!legacyCols[key]) legacyCols[key] = new Set();
        legacyCols[key].add(String(val).trim());
      }
    }
  } catch {
    console.log("ℹ️   enrolment_report_lines not readable yet — using fallback lookups");
  }

  for (const [domainKey, domain] of Object.entries(domainMap)) {
    const fromLegacy = legacyCols[domainKey] ? [...legacyCols[domainKey]] : [];
    const fallback = FALLBACK_LOOKUP_VALUES[domainKey] || [];
    const labels = [...new Set([...fallback, ...fromLegacy])];
    let sort = 0;
    for (const label of labels) {
      sort += 1;
      await LookupValue.findOrCreate({
        where: { domain_id: domain.id, code: slugCode(label) },
        defaults: {
          label,
          sort_order: sort,
          is_active: true,
        },
      });
    }
    console.log(`  lookup ${domainKey}: ${labels.length} values`);
  }

  return domainMap;
}

async function seedEnrolmentForm(domainMap) {
  const [mod] = await Module.findOrCreate({
    where: { key_name: "zonal" },
    defaults: { label: "Zonal", sort_order: 10, is_active: true },
  });

  const [feature] = await Feature.findOrCreate({
    where: { module_id: mod.id, key_name: "enrolment" },
    defaults: { label: "Enrolment", sort_order: 10, is_active: true },
  });

  const [template] = await FormTemplate.findOrCreate({
    where: { key_name: "enrolment" },
    defaults: {
      feature_id: feature.id,
      name: "Enrolment Monthly Report",
      description: "State office enrolment activity (platform redesign)",
      period_type: "month",
      workflow_key: "so_simple",
      allow_lines: true,
      is_active: true,
    },
  });

  let version = await FormTemplateVersion.findOne({
    where: { template_id: template.id, version_no: 1 },
  });
  if (!version) {
    version = await FormTemplateVersion.create({
      template_id: template.id,
      version_no: 1,
      is_current: true,
      published_at: new Date(),
    });
  } else if (!version.is_current) {
    await version.update({ is_current: true });
  }

  const [section] = await FormSection.findOrCreate({
    where: { version_id: version.id, key_name: "lines" },
    defaults: {
      title: "Enrolment Activities",
      is_repeating: true,
      sort_order: 1,
    },
  });

  let sort = 0;
  for (const f of ENROLMENT_LINE_FIELDS) {
    sort += 1;
    const lookupDomainId = f.lookup ? domainMap[f.lookup]?.id || null : null;
    await FormField.findOrCreate({
      where: { section_id: section.id, key_name: f.key_name },
      defaults: {
        label: f.label,
        data_type: f.data_type,
        lookup_domain_id: lookupDomainId,
        is_required: !!f.is_required,
        is_metric: !!f.is_metric,
        metric_key: f.metric_key || null,
        sort_order: sort,
      },
    });
  }

  await DimForm.findOrCreate({
    where: { form_key: "enrolment" },
    defaults: { module_key: "zonal", label: "Enrolment" },
  });

  console.log("✅  Enrolment form template v1 ready");
  return { template, version, section, feature };
}

async function seedWorkflow() {
  const [wf] = await WorkflowDefinition.findOrCreate({
    where: { key_name: "so_simple" },
    defaults: { name: "State Office Simple", is_active: true },
  });

  const transitions = [
    { from_status: "draft", action: "submit", to_status: "submitted", required_flag: "create", sort_order: 1 },
    { from_status: "submitted", action: "approve", to_status: "approved", required_flag: "review", sort_order: 2 },
    { from_status: "submitted", action: "return", to_status: "draft", required_flag: "review", sort_order: 3 },
    { from_status: "approved", action: "reopen", to_status: "draft", required_flag: "admin", sort_order: 4 },
  ];

  for (const t of transitions) {
    await WorkflowTransition.findOrCreate({
      where: { workflow_id: wf.id, from_status: t.from_status, action: t.action },
      defaults: t,
    });
  }
  console.log("✅  Workflow so_simple seeded");
}

async function seedMetrics() {
  const metrics = [
    { metric_key: "enrolment_count", label: "Enrolments", category: "enrolment", unit: "count" },
    { metric_key: "enrollees_validated", label: "Enrollees Validated", category: "enrolment", unit: "count" },
    { metric_key: "activity_budget", label: "Activity Budget", category: "enrolment", unit: "naira" },
    { metric_key: "approved_amount", label: "Approved Amount", category: "enrolment", unit: "naira" },
  ];
  for (const m of metrics) {
    await DimMetric.findOrCreate({
      where: { metric_key: m.metric_key },
      defaults: { ...m, aggregation: "sum", is_active: true },
    });
  }
  console.log("✅  dim_metric seeded");
}

async function seedGeography() {
  const zones = await ZonalOffice.findAll();
  const states = await StateOffice.findAll();
  let n = 0;
  for (const st of states) {
    const zone = zones.find((z) => z.id === st.zonal_id);
    if (!zone) continue;
    const [, created] = await DimGeography.findOrCreate({
      where: { zone_id: zone.id, state_id: st.id },
      defaults: {
        zone_code: zone.zonal_code,
        zone_name: zone.description,
        state_code: st.code,
        state_name: st.description,
      },
    });
    if (created) n += 1;
  }
  console.log(`✅  dim_geography synced (+${n} new)`);
}

(async () => {
  try {
    await sequelize.authenticate();
    const year = new Date().getFullYear();
    await ensureDimDates([year - 1, year, year + 1]);
    console.log("✅  dim_date seeded");

    await seedWorkflow();
    await seedMetrics();
    const domainMap = await seedLookupsFromLegacy();
    await seedEnrolmentForm(domainMap);
    await seedGeography();

    console.log("✅  Redesign core seed complete");
    process.exit(0);
  } catch (err) {
    console.error("❌  Redesign seed failed:", err);
    process.exit(1);
  }
})();
