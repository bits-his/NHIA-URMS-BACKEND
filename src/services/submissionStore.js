const { Op } = require("sequelize");
const sequelize = require("../config/database");
const Submission = require("../models/Submission");
const SubmissionLine = require("../models/SubmissionLine");
const SubmissionFile = require("../models/SubmissionFile");
const ZonalOffice = require("../models/ZonalOffice");
const StateOffice = require("../models/StateOffice");

const COLUMNS = new Set([
  "reference_id", "report_type", "zone_id", "state_id",
  "reporting_year", "reporting_month", "reporting_week",
  "submission_date", "submitted_by", "status", "title",
  "coordinator_review_note", "coordinator_reviewed_by", "coordinator_reviewed_at",
]);

const SKIP_HEADER = new Set([
  "id", "lines", "files", "zone", "state", "update", "toJSON",
  "created_at", "updated_at", "createdAt", "updatedAt",
  "summary_lines", "status_lines", "visit_lines", "reconciliation_lines",
  "scores", "findings", "recommendations", "kpi", "evidence",
]);

const GEO_INCLUDE = [
  { model: ZonalOffice, as: "zone", attributes: ["id", "description", "zonal_code"] },
  { model: StateOffice, as: "state", attributes: ["id", "description", "code", "zonal_id"] },
];

const firstNum = (...values) => {
  for (const value of values) {
    if (value == null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

function asObject(value) {
  if (value == null) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? value : {};
}

function metrics(row) {
  const category = row.category || row.engagement_category || row.service
    || row.request_type || row.intervention_type || row.support_category
    || row.line_kind || null;
  const facility = row.facility_id || row.hcf_code || row.facility_code || null;
  return {
    category: category != null ? String(category).slice(0, 120) : null,
    quantity: firstNum(row.quantity, row.enrolment_count, row.request_count, row.beneficiaries, row.primary_count, row.facilities_covered, row.complaint_count, row.status_count),
    amount: firstNum(row.amount, row.approved_amount, row.activity_budget, row.amount_owed, row.alleged_amount, row.nhia_cap),
    facility_id: facility != null ? String(facility).slice(0, 64) : null,
    facility_name: row.facility_name || row.facility_visited || row.hcf_name || null,
    quarter: row.quarter != null && row.quarter !== "" ? Number(row.quarter) : null,
  };
}

function splitValues(values = {}) {
  const columns = {};
  const header = {};
  for (const key of Object.keys(values)) {
    if (SKIP_HEADER.has(key)) continue;
    if (COLUMNS.has(key)) columns[key] = values[key];
    else header[key] = values[key];
  }
  return { columns, header };
}

function headerClause(key, value) {
  const path = String(key).replace(/[^a-zA-Z0-9_]/g, "");
  const extract = sequelize.literal(
    `JSON_UNQUOTE(JSON_EXTRACT(\`Submission\`.\`header\`, '$.${path}'))`,
  );
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (value[Op.or]) {
      return {
        [Op.or]: value[Op.or].map((item) => (
          item == null
            ? sequelize.where(extract, { [Op.is]: null })
            : sequelize.where(extract, String(item))
        )),
      };
    }
    const symbols = Object.getOwnPropertySymbols(value);
    if (symbols.length) return sequelize.where(extract, value);
  }
  if (value == null) return sequelize.where(extract, { [Op.is]: null });
  return sequelize.where(extract, String(value));
}

function splitWhere(where, reportType) {
  const columnWhere = {};
  const headerWheres = [];
  if (reportType) columnWhere.report_type = reportType;
  if (!where) return { columnWhere, headerWheres };
  for (const key of Reflect.ownKeys(where)) {
    if (typeof key === "symbol") {
      columnWhere[key] = where[key];
      continue;
    }
    if (key === "report_type" && reportType) continue;
    if (COLUMNS.has(key) || key === "id" || key === "created_at" || key === "updated_at") {
      columnWhere[key] = where[key];
    } else {
      headerWheres.push(headerClause(key, where[key]));
    }
  }
  return { columnWhere, headerWheres };
}

function sqlWhere(columnWhere, headerWheres) {
  const parts = [];
  if (Object.keys(columnWhere).length || Object.getOwnPropertySymbols(columnWhere).length) {
    parts.push(columnWhere);
  }
  parts.push(...headerWheres);
  if (parts.length <= 1) return parts[0] || {};
  return { [Op.and]: parts };
}

function sortRows(rows, order) {
  if (!Array.isArray(order) || !order.length) return rows;
  const specs = order.map((item) => (Array.isArray(item) ? item : [item, "ASC"]));
  return [...rows].sort((a, b) => {
    for (const [field, dir] of specs) {
      const av = a[field];
      const bv = b[field];
      if (av == bv) continue;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return String(dir).toUpperCase() === "DESC" ? 1 : -1;
      if (av > bv) return String(dir).toUpperCase() === "DESC" ? -1 : 1;
    }
    return 0;
  });
}

function groupRows(rows, group) {
  if (!group) return rows;
  const fields = [].concat(group);
  const seen = new Set();
  return rows.filter((row) => {
    const key = fields.map((field) => row[field]).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function wantsLines(include) {
  return [].concat(include || []).some((item) => item && (item.as === "lines" || item.association === "lines"));
}

async function rememberFiles(submissionId, lineId, docs, transaction) {
  const list = Array.isArray(docs) ? docs : [];
  for (const doc of list) {
    const filePath = doc?.path || doc?.file_path;
    if (!filePath) continue;
    const existing = await SubmissionFile.findOne({
      where: { submission_id: submissionId, file_path: filePath },
      transaction,
    });
    if (existing) continue;
    await SubmissionFile.create({
      submission_id: submissionId,
      line_id: lineId || null,
      file_path: filePath,
      original_name: doc.name || doc.file_name || doc.original_name || null,
      kind: lineId ? "line" : "header",
    }, { transaction });
  }
}

/**
 * A report-shaped store backed by submissions + submission_lines.
 * Pass a reportType to lock every read and write to that form.
 * Pass null when the caller sets report_type itself (Admin/HR).
 */
function defineReportStore(reportType) {
  const cache = new Map();

  function remember(record) {
    cache.set(record.id, record);
    return record;
  }

  function hydrateLine(row) {
    const json = row.get ? row.get({ plain: true }) : row;
    const extra = asObject(json.extra);
    const line = {
      ...extra,
      id: json.id,
      report_id: json.submission_id,
      sheet_id: json.submission_id,
      visit_id: json.submission_id,
      line_no: json.line_no,
      quarter: json.quarter != null ? Number(json.quarter) : extra.quarter ?? null,
    };
    if (json.quantity != null && line.quantity == null) line.quantity = Number(json.quantity);
    if (json.amount != null && line.amount == null) line.amount = Number(json.amount);
    line.update = async (patch, opts = {}) => {
      const current = await SubmissionLine.findByPk(json.id, { transaction: opts.transaction });
      if (!current) return null;
      const nextExtra = { ...asObject(current.extra), ...patch };
      const next = metrics(nextExtra);
      await current.update({
        extra: nextExtra,
        category: next.category,
        quantity: next.quantity,
        amount: next.amount,
        facility_id: next.facility_id,
        facility_name: next.facility_name,
        quarter: next.quarter,
      }, { transaction: opts.transaction });
      const docs = [
        ...(Array.isArray(nextExtra.supporting_documents) ? nextExtra.supporting_documents : []),
        ...(Array.isArray(nextExtra.activity_template?.supporting_documents) ? nextExtra.activity_template.supporting_documents : []),
      ];
      await rememberFiles(current.submission_id, current.id, docs, opts.transaction);
      const fresh = hydrateLine(await SubmissionLine.findByPk(current.id, { transaction: opts.transaction }));
      Object.assign(line, fresh);
      line.update = fresh.update;
      return line;
    };
    line.toJSON = () => {
      const { update, toJSON, ...rest } = line;
      return rest;
    };
    return line;
  }

  function hydrate(row, lines = []) {
    const json = row.get ? row.get({ plain: true }) : row;
    const header = asObject(json.header);
    const record = {
      ...header,
      id: json.id,
      reference_id: json.reference_id,
      report_type: json.report_type,
      zone_id: json.zone_id,
      state_id: json.state_id,
      reporting_year: json.reporting_year,
      reporting_month: json.reporting_month,
      reporting_week: json.reporting_week,
      submission_date: json.submission_date,
      submitted_by: json.submitted_by,
      status: json.status,
      title: json.title,
      coordinator_review_note: json.coordinator_review_note,
      coordinator_reviewed_by: json.coordinator_reviewed_by,
      coordinator_reviewed_at: json.coordinator_reviewed_at,
      created_at: json.created_at || json.createdAt,
      updated_at: json.updated_at || json.updatedAt,
      createdAt: json.createdAt || json.created_at,
      updatedAt: json.updatedAt || json.updated_at,
      zone: json.zone || null,
      state: json.state || null,
      lines: lines.map(hydrateLine),
    };
    record.update = async (values, opts = {}) => {
      await Report.update(values, { where: { id: record.id }, transaction: opts.transaction });
      const fresh = await Report.findByPk(record.id, { transaction: opts.transaction });
      if (fresh) {
        const keepUpdate = record.update;
        Object.assign(record, fresh);
        record.update = keepUpdate;
      }
      return record;
    };
    record.toJSON = () => {
      const { update, toJSON, ...rest } = record;
      return rest;
    };
    return remember(record);
  }

  async function loadLines(ids, transaction) {
    if (!ids.length) return new Map();
    const rows = await SubmissionLine.findAll({
      where: { submission_id: { [Op.in]: ids } },
      order: [["line_no", "ASC"], ["id", "ASC"]],
      transaction,
    });
    const grouped = new Map();
    for (const row of rows) {
      const bucket = grouped.get(row.submission_id) || [];
      bucket.push(row);
      grouped.set(row.submission_id, bucket);
    }
    return grouped;
  }

  async function fetchRows(where, transaction) {
    return Submission.findAll({
      where,
      include: GEO_INCLUDE,
      order: [["createdAt", "DESC"]],
      transaction,
    });
  }

  const Report = {
    rawAttributes: { submitted_by: { field: "submitted_by" } },
    async count(opts = {}) {
      const { columnWhere, headerWheres } = splitWhere(opts.where, reportType);
      return Submission.count({
        where: sqlWhere(columnWhere, headerWheres),
        transaction: opts.transaction,
      });
    },
    async findAll(opts = {}) {
      const { columnWhere, headerWheres } = splitWhere(opts.where, reportType);
      const rows = await fetchRows(sqlWhere(columnWhere, headerWheres), opts.transaction);
      const grouped = await loadLines(rows.map((row) => row.id), opts.transaction);
      let records = rows.map((row) => hydrate(row, grouped.get(row.id) || []));
      records = sortRows(records, opts.order);
      records = groupRows(records, opts.group);
      if (opts.limit) records = records.slice(opts.offset || 0, (opts.offset || 0) + opts.limit);
      return records;
    },
    async findByPk(id, opts = {}) {
      if (cache.has(Number(id)) && opts.transaction == null && !opts.include) {
        // Always re-read so a status change from another request is visible.
      }
      const row = await Submission.findByPk(id, { include: GEO_INCLUDE, transaction: opts.transaction });
      if (!row) return null;
      if (reportType && row.report_type !== reportType) return null;
      const grouped = await loadLines([row.id], opts.transaction);
      return hydrate(row, grouped.get(row.id) || []);
    },
    async findOne(opts = {}) {
      const { columnWhere, headerWheres } = splitWhere(opts.where, reportType);
      const row = await Submission.findOne({
        where: sqlWhere(columnWhere, headerWheres),
        include: GEO_INCLUDE,
        transaction: opts.transaction,
      });
      if (!row) return null;
      const grouped = await loadLines([row.id], opts.transaction);
      return hydrate(row, grouped.get(row.id) || []);
    },
    async create(values, opts = {}) {
      const { columns, header } = splitValues(values);
      const type = reportType || columns.report_type || values.report_type;
      if (!type) {
        const err = new Error("report_type is required");
        err.status = 422;
        throw err;
      }
      if (!columns.reference_id) {
        const err = new Error("reference_id is required");
        err.status = 422;
        throw err;
      }
      const row = await Submission.create({
        ...columns,
        report_type: type,
        header,
        status: columns.status || "draft",
      }, { transaction: opts.transaction });
      if (header.source_document_path) {
        await rememberFiles(row.id, null, [{ path: header.source_document_path, name: header.source_document_name }], opts.transaction);
      }
      const full = await Submission.findByPk(row.id, { include: GEO_INCLUDE, transaction: opts.transaction });
      return hydrate(full, []);
    },
    async update(values, opts = {}) {
      const id = opts.where?.id;
      if (!id) {
        const err = new Error("Submission update requires where.id");
        err.status = 422;
        throw err;
      }
      const row = await Submission.findByPk(id, { transaction: opts.transaction });
      if (!row || (reportType && row.report_type !== reportType)) return null;
      const { columns, header } = splitValues(values);
      await row.update({
        ...columns,
        header: { ...asObject(row.header), ...header },
      }, { transaction: opts.transaction });
      if (header.source_document_path) {
        await rememberFiles(row.id, null, [{ path: header.source_document_path, name: header.source_document_name }], opts.transaction);
      }
      return Report.findByPk(id, opts);
    },
    async sync() {
      await Submission.sync();
      await SubmissionLine.sync();
      await SubmissionFile.sync();
    },
  };

  const Line = {
    async bulkCreate(rows, opts = {}) {
      const created = [];
      let n = 1;
      for (const raw of rows) {
        const row = { ...raw };
        const submissionId = row.report_id || row.sheet_id || row.visit_id;
        delete row.report_id;
        delete row.sheet_id;
        delete row.visit_id;
        const next = metrics(row);
        const saved = await SubmissionLine.create({
          submission_id: submissionId,
          line_no: n,
          category: next.category,
          quantity: next.quantity,
          amount: next.amount,
          facility_id: next.facility_id,
          facility_name: next.facility_name,
          quarter: next.quarter,
          extra: row,
        }, { transaction: opts.transaction });
        created.push(hydrateLine(saved));
        n += 1;
      }
      return created;
    },
    async destroy(opts = {}) {
      const parentId = opts.where?.report_id || opts.where?.sheet_id || opts.where?.visit_id;
      if (!parentId) return 0;
      return SubmissionLine.destroy({
        where: { submission_id: parentId },
        transaction: opts.transaction,
      });
    },
    async findOne(opts = {}) {
      const parentId = opts.where?.report_id || opts.where?.sheet_id || opts.where?.visit_id;
      const row = await SubmissionLine.findOne({
        where: {
          ...(opts.where?.id ? { id: opts.where.id } : {}),
          ...(parentId ? { submission_id: parentId } : {}),
        },
        transaction: opts.transaction,
      });
      return row ? hydrateLine(row) : null;
    },
    async findAll(opts = {}) {
      const reportInclude = [].concat(opts.include || []).find((item) => item && item.as === "report");
      const parents = await Report.findAll({
        where: reportInclude?.where || {},
        transaction: opts.transaction,
      });
      const lines = parents.flatMap((parent) => parent.lines || []);
      if (!opts.attributes) return lines;
      return lines.map((line) => {
        const picked = {};
        for (const field of opts.attributes) picked[field] = line[field];
        return picked;
      });
    },
  };

  // findAll on reports always has lines. The include flag is accepted so existing
  // controllers can keep passing { model, as: "lines" }.
  const originalFindAll = Report.findAll.bind(Report);
  Report.findAll = async (opts = {}) => {
    const rows = await originalFindAll(opts);
    if (opts.include && !wantsLines(opts.include) && opts.attributes && !opts.include.some((item) => item.as === "lines" || item.association === "lines")) {
      return rows;
    }
    return rows;
  };

  return { Report, Line };
}

function retiredModel(name) {
  const fail = async () => {
    const err = new Error(`${name} is no longer a table. Use submissions.`);
    err.status = 410;
    throw err;
  };
  return {
    rawAttributes: {},
    findAll: async () => [],
    findOne: async () => null,
    findByPk: async () => null,
    count: async () => 0,
    create: fail,
    destroy: async () => 0,
    update: async () => [0],
    bulkCreate: fail,
    sync: async () => {},
  };
}

module.exports = { defineReportStore, retiredModel, Submission, SubmissionLine, SubmissionFile };
