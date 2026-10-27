const { fn, col, literal } = require("sequelize");
const {
  LookupDomain,
  LookupValue,
  FormTemplate,
  FormTemplateVersion,
  FormSection,
  FormField,
  FormSubmission,
  FactReportMetric,
  DimGeography,
  DimDate,
  DimMetric,
} = require("../../models/redesign");

/** GET /api/platform/lookups/:domainKey */
async function getLookupDomain(req, res, next) {
  try {
    const domain = await LookupDomain.findOne({
      where: { key_name: req.params.domainKey, is_active: true },
    });
    if (!domain) {
      return res.status(404).json({ success: false, message: "Lookup domain not found" });
    }
    const values = await LookupValue.findAll({
      where: { domain_id: domain.id, is_active: true },
      order: [["sort_order", "ASC"], ["label", "ASC"]],
      attributes: ["id", "code", "label", "parent_id", "sort_order", "meta_json"],
    });
    res.json({
      success: true,
      data: {
        key: domain.key_name,
        label: domain.label,
        values,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/platform/forms/:key/schema */
async function getFormSchema(req, res, next) {
  try {
    const template = await FormTemplate.findOne({
      where: { key_name: req.params.key, is_active: true },
    });
    if (!template) {
      return res.status(404).json({ success: false, message: "Form template not found" });
    }
    const version = await FormTemplateVersion.findOne({
      where: { template_id: template.id, is_current: true },
    });
    if (!version) {
      return res.status(404).json({ success: false, message: "No published form version" });
    }
    const sections = await FormSection.findAll({
      where: { version_id: version.id },
      order: [["sort_order", "ASC"]],
      include: [
        {
          model: FormField,
          as: "fields",
          include: [{ model: LookupDomain, as: "lookup_domain", attributes: ["id", "key_name", "label"] }],
        },
      ],
    });

    // Sort fields inside sections
    const payload = sections.map((s) => {
      const json = s.toJSON();
      json.fields = (json.fields || []).sort((a, b) => a.sort_order - b.sort_order);
      return json;
    });

    res.json({
      success: true,
      data: {
        key: template.key_name,
        name: template.name,
        period_type: template.period_type,
        workflow_key: template.workflow_key,
        allow_lines: template.allow_lines,
        version_no: version.version_no,
        version_id: version.id,
        sections: payload,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/platform/analytics/metrics?metric_key=&year=&zone_id=&state_id=&status=approved */
async function getAnalyticsMetrics(req, res, next) {
  try {
    const {
      metric_key: metricKey,
      year,
      zone_id: zoneId,
      state_id: stateId,
      status = "approved",
      form_key: formKey,
    } = req.query;

    if (!metric_key && !metricKey) {
      // allow either
    }
    if (!metricKey) {
      return res.status(422).json({ success: false, message: "metric_key is required" });
    }

    const where = {
      metric_key: metricKey,
      status,
    };
    if (formKey) where.form_key = formKey;

    const include = [
      {
        model: DimGeography,
        as: "geo",
        required: true,
        where: {
          ...(zoneId ? { zone_id: Number(zoneId) } : {}),
          ...(stateId ? { state_id: Number(stateId) } : {}),
        },
      },
      {
        model: DimDate,
        as: "date",
        required: true,
        where: year ? { year_num: Number(year) } : undefined,
      },
      { model: DimMetric, as: "metric", attributes: ["metric_key", "label", "unit", "category"] },
    ];

    const rows = await FactReportMetric.findAll({
      attributes: [
        "metric_key",
        "status",
        "form_key",
        [fn("SUM", col("value_number")), "total"],
        [col("date.year_num"), "year_num"],
        [col("date.month_num"), "month_num"],
        [col("geo.zone_id"), "zone_id"],
        [col("geo.state_id"), "state_id"],
        [col("geo.zone_name"), "zone_name"],
        [col("geo.state_name"), "state_name"],
      ],
      where,
      include,
      group: [
        "FactReportMetric.metric_key",
        "FactReportMetric.status",
        "FactReportMetric.form_key",
        "date.year_num",
        "date.month_num",
        "geo.zone_id",
        "geo.state_id",
        "geo.zone_name",
        "geo.state_name",
        "metric.metric_key",
      ],
      order: [
        [literal("year_num"), "ASC"],
        [literal("month_num"), "ASC"],
        [literal("state_name"), "ASC"],
      ],
      raw: true,
      nest: false,
    });

    res.json({
      success: true,
      data: rows.map((r) => ({
        metric_key: r.metric_key,
        form_key: r.form_key,
        status: r.status,
        year: r.year_num,
        month: r.month_num,
        zone_id: r.zone_id,
        state_id: r.state_id,
        zone_name: r.zone_name,
        state_name: r.state_name,
        total: Number(r.total) || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/platform/submissions?form_key=enrolment */
async function listSubmissions(req, res, next) {
  try {
    const formKey = req.query.form_key || "enrolment";
    const template = await FormTemplate.findOne({ where: { key_name: formKey } });
    if (!template) {
      return res.status(404).json({ success: false, message: "Form not found" });
    }
    const where = { template_id: template.id, deleted_at: null };
    if (req.query.zone_id) where.zone_id = Number(req.query.zone_id);
    if (req.query.state_id) where.state_id = Number(req.query.state_id);
    if (req.query.status) where.status = req.query.status;
    if (req.query.year) where.period_year = Number(req.query.year);

    const list = await FormSubmission.findAll({
      where,
      order: [["updated_at", "DESC"]],
      limit: Math.min(Number(req.query.limit) || 100, 500),
    });
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLookupDomain,
  getFormSchema,
  getAnalyticsMetrics,
  listSubmissions,
};
