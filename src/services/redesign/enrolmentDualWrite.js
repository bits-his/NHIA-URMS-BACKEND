/**
 * Dual-write legacy EnrolmentReport → form engine + fact metrics.
 * Failures are logged; they must not break the legacy API response.
 */
const {
  FormTemplate,
  FormTemplateVersion,
  FormSection,
  FormField,
  FormSubmission,
  FormLineGroup,
  FormLineAnswer,
  SubmissionStatusEvent,
  DimDate,
  DimGeography,
  DimMetric,
  DimForm,
  FactReportMetric,
  LookupDomain,
  LookupValue,
} = require("../../models/redesign");

function periodKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function dateKeyFromPeriod(year, month) {
  return Number(year) * 10000 + Number(month) * 100 + 1;
}

function slugCode(label) {
  if (label == null || String(label).trim() === "") return null;
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80) || null;
}

function valuePayload(field, raw) {
  if (raw == null || raw === "") {
    return {
      value_text: null,
      value_number: null,
      value_date: null,
      value_bool: null,
      value_json: null,
    };
  }
  switch (field.data_type) {
    case "integer":
    case "decimal":
      return { value_number: Number(raw), value_text: String(raw) };
    case "date":
      return { value_date: raw, value_text: String(raw) };
    case "boolean":
      return { value_bool: !!raw, value_text: String(!!raw) };
    case "json":
      return { value_json: typeof raw === "string" ? JSON.parse(raw) : raw };
    case "textarea":
    case "text":
    case "lookup":
    default:
      return { value_text: String(raw) };
  }
}

async function resolveLookupId(field, raw, cache) {
  if (field.data_type !== "lookup" || !field.lookup_domain_id || raw == null || raw === "") {
    return null;
  }
  const code = slugCode(raw);
  if (!code) return null;
  const cacheKey = `${field.lookup_domain_id}:${code}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  let row = await LookupValue.findOne({
    where: { domain_id: field.lookup_domain_id, code },
  });
  if (!row) {
    row = await LookupValue.create({
      domain_id: field.lookup_domain_id,
      code,
      label: String(raw).trim(),
      sort_order: 999,
      is_active: true,
    });
  }
  cache.set(cacheKey, row.id);
  return row.id;
}

async function loadEnrolmentMeta() {
  const template = await FormTemplate.findOne({ where: { key_name: "enrolment", is_active: true } });
  if (!template) return null;
  const version = await FormTemplateVersion.findOne({
    where: { template_id: template.id, is_current: true },
  });
  if (!version) return null;
  const section = await FormSection.findOne({
    where: { version_id: version.id, key_name: "lines" },
  });
  if (!section) return null;
  const fields = await FormField.findAll({ where: { section_id: section.id } });
  const fieldByKey = Object.fromEntries(fields.map((f) => [f.key_name, f]));
  return { template, version, section, fields, fieldByKey };
}

async function ensureDims(report) {
  const dk = dateKeyFromPeriod(report.reporting_year, report.reporting_month);
  await DimDate.findOrCreate({
    where: { date_key: dk },
    defaults: {
      full_date: `${report.reporting_year}-${String(report.reporting_month).padStart(2, "0")}-01`,
      year_num: report.reporting_year,
      quarter_num: Math.ceil(report.reporting_month / 3),
      month_num: report.reporting_month,
      month_name: String(report.reporting_month),
    },
  });

  await DimForm.findOrCreate({
    where: { form_key: "enrolment" },
    defaults: { module_key: "zonal", label: "Enrolment" },
  });

  let geo = await DimGeography.findOne({
    where: { zone_id: report.zone_id, state_id: report.state_id },
  });
  if (!geo) {
    const ZonalOffice = require("../../models/ZonalOffice");
    const StateOffice = require("../../models/StateOffice");
    const zone = await ZonalOffice.findByPk(report.zone_id);
    const state = await StateOffice.findByPk(report.state_id);
    if (zone && state) {
      geo = await DimGeography.create({
        zone_id: zone.id,
        state_id: state.id,
        zone_code: zone.zonal_code,
        zone_name: zone.description,
        state_code: state.code,
        state_name: state.description,
      });
    }
  }
  return { dateKey: dk, geoKey: geo?.geo_key || null };
}

async function publishFacts(submission, report, meta, dims) {
  if (!dims.geoKey) return;
  await FactReportMetric.destroy({ where: { submission_id: submission.id } });

  const metricFields = meta.fields.filter((f) => f.is_metric && f.metric_key);
  for (const m of metricFields) {
    await DimMetric.findOrCreate({
      where: { metric_key: m.metric_key },
      defaults: {
        label: m.label,
        category: "enrolment",
        unit: m.data_type === "decimal" ? "naira" : "count",
        aggregation: "sum",
        is_active: true,
      },
    });
  }

  const groups = await FormLineGroup.findAll({
    where: { submission_id: submission.id },
    include: [{ model: FormLineAnswer, as: "answers" }],
  });

  const rows = [];
  for (const g of groups) {
    for (const ans of g.answers || []) {
      const field = meta.fields.find((f) => f.id === ans.field_id);
      if (!field?.is_metric || !field.metric_key) continue;
      const num = ans.value_number != null ? Number(ans.value_number) : 0;
      rows.push({
        date_key: dims.dateKey,
        geo_key: dims.geoKey,
        form_key: "enrolment",
        metric_key: field.metric_key,
        status: report.status,
        submission_id: submission.id,
        line_group_id: g.id,
        value_number: num,
        published_at: new Date(),
      });
    }
  }
  if (rows.length) await FactReportMetric.bulkCreate(rows);
}

/**
 * @param {object} report  EnrolmentReport instance (with lines preferred)
 * @param {{ action?: string, userId?: number, fromStatus?: string, note?: string }} meta
 */
async function dualWriteEnrolment(report, meta = {}) {
  if (process.env.NHIA_REDESIGN_DUAL_WRITE === "0") return null;

  try {
    const formMeta = await loadEnrolmentMeta();
    if (!formMeta) {
      console.warn("[redesign] Enrolment form template missing — run npm run db:redesign:seed");
      return null;
    }

    // Reload lines if missing
    let lines = report.lines;
    if (!lines) {
      const EnrolmentReportLine = require("../../models/EnrolmentReportLine");
      lines = await EnrolmentReportLine.findAll({ where: { report_id: report.id } });
    }

    const pk = periodKey(report.reporting_year, report.reporting_month);
    let submission = await FormSubmission.findOne({
      where: { reference_id: report.reference_id },
    });

    const base = {
      template_id: formMeta.template.id,
      version_id: formMeta.version.id,
      reference_id: report.reference_id,
      legacy_report_id: report.id,
      zone_id: report.zone_id,
      state_id: report.state_id,
      period_key: pk,
      period_year: report.reporting_year,
      period_month: report.reporting_month,
      status: report.status,
      submitted_by: meta.userId || null,
      submitted_at: report.status === "submitted" || report.status === "approved" ? new Date() : null,
      created_by: meta.userId || null,
    };

    if (!submission) {
      try {
        submission = await FormSubmission.create(base);
      } catch (err) {
        // Race / unique period — update existing by period
        submission = await FormSubmission.findOne({
          where: {
            template_id: formMeta.template.id,
            zone_id: report.zone_id,
            state_id: report.state_id,
            period_key: pk,
          },
        });
        if (!submission) throw err;
        await submission.update(base);
      }
    } else {
      await submission.update(base);
    }

    // Replace lines
    await FormLineGroup.destroy({ where: { submission_id: submission.id } });
    const lookupCache = new Map();

    for (let i = 0; i < (lines || []).length; i++) {
      const line = lines[i].toJSON ? lines[i].toJSON() : lines[i];
      const group = await FormLineGroup.create({
        submission_id: submission.id,
        section_id: formMeta.section.id,
        line_index: i,
      });

      const answerRows = [];
      for (const field of formMeta.fields) {
        const raw = line[field.key_name];
        if (raw == null || raw === "") continue;
        const payload = valuePayload(field, raw);
        if (field.data_type === "json" && payload.value_json === undefined) {
          try {
            payload.value_json = typeof raw === "object" ? raw : JSON.parse(raw);
          } catch {
            payload.value_json = raw;
          }
        }
        const lookup_value_id = await resolveLookupId(field, raw, lookupCache);
        answerRows.push({
          line_group_id: group.id,
          field_id: field.id,
          ...payload,
          lookup_value_id,
        });
      }
      if (answerRows.length) await FormLineAnswer.bulkCreate(answerRows);
    }

    if (meta.action) {
      await SubmissionStatusEvent.create({
        submission_id: submission.id,
        from_status: meta.fromStatus || null,
        to_status: report.status,
        action: meta.action,
        actor_user_id: meta.userId || null,
        note: meta.note || null,
      });
    }

    if (report.status === "approved") {
      const dims = await ensureDims(report);
      await publishFacts(submission, report, formMeta, dims);
    } else {
      // Keep facts in sync with current status or clear if not approved
      await FactReportMetric.destroy({ where: { submission_id: submission.id } });
    }

    return submission;
  } catch (err) {
    console.error("[redesign] dualWriteEnrolment failed:", err.message);
    return null;
  }
}

module.exports = {
  dualWriteEnrolment,
  periodKey,
  loadEnrolmentMeta,
};
