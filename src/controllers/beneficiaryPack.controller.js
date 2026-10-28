/**
 * Beneficiary Management pack — parent + shared form_documents.
 * Mounted as extra-dependant / hcf-change / hmo-selection with activity_type filters.
 * FE posts lines[]; each line → one row. Responses synthesize lines[] + doc arrays.
 */
const { Op } = require("sequelize");
const {
  BeneficiaryManagementReport,
  ZonalOffice,
  StateOffice,
} = require("../models");
const { canReviewMonthlyReport } = require("../utils/monthlyReportScope");
const {
  SEGMENT_ACTIVITY_TYPES,
  BENEFICIARY_SEGMENTS,
  prefixFor,
  resolveActivityType,
} = require("../utils/beneficiaryManagementTypes");
const {
  listDocuments,
  replaceDocuments: replaceFormDocuments,
  appendDocuments: appendFormDocuments,
  docsToArrays,
} = require("../utils/formDocuments");

const BM_FORM_KEY = "beneficiary-management";

function quarterFromMonth(month) {
  const m = Number(month);
  if (!m || m < 1 || m > 12) return null;
  return Math.ceil(m / 3);
}

function optNum(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function geoFromBody(user, body = {}) {
  return {
    zonal_code: body.zonal_code || body.zone_id || user?.zonal_code || null,
    state_code: body.state_code || body.state_id || user?.state_code || null,
    department_code: body.department_code || user?.department_code || null,
    unit_code: body.unit_code || user?.unit_code || null,
  };
}

function unpackReason(raw) {
  const text = String(raw ?? "");
  const OTHER = "Other (Specify)";
  if (text === OTHER || text.startsWith(`${OTHER}:`)) {
    return {
      reason_category: OTHER,
      reason_other: text.slice(OTHER.length).replace(/^:\s*/, ""),
    };
  }
  return { reason_category: text || null, reason_other: null };
}

function packReason(category, other) {
  const OTHER = "Other (Specify)";
  if (!category) return null;
  if (category === OTHER) return other?.trim() ? `${OTHER}: ${other.trim()}` : OTHER;
  return category;
}

function identityFromLine(line = {}) {
  const bag = {};
  if (Array.isArray(line.supporting_documents)) {
    for (const d of line.supporting_documents) {
      if (d && d.field && d.value != null) bag[d.field] = d.value;
    }
  }
  const id = line.identity && typeof line.identity === "object" ? line.identity : {};
  return {
    surname: line.surname || id.surname || bag.surname || null,
    first_name: line.first_name || id.first_name || bag.first_name || null,
    middle_name: line.middle_name || id.middle_name || bag.middle_name || null,
    nin: line.nin || id.nin || bag.nin || null,
    blood_group: line.blood_group || id.blood_group || bag.blood_group || null,
    marital_status: line.marital_status || id.marital_status || bag.marital_status || null,
    state_of_origin: line.state_of_origin || id.state_of_origin || bag.state_of_origin || null,
    lga_of_origin: line.lga_of_origin || id.lga_of_origin || bag.lga_of_origin || null,
    state_of_residence: line.state_of_residence || id.state_of_residence || bag.state_of_residence || null,
    lga_of_residence: line.lga_of_residence || id.lga_of_residence || bag.lga_of_residence || null,
    phone_number: line.phone_number || id.phone_number || bag.phone_number || null,
    hmo_name: line.hmo_name || id.hmo || bag.hmo || null,
    hcf: line.hcf || bag.hcf || null,
    alternative_provider: line.alternative_provider || bag.alternative_provider || null,
  };
}

function docsFromLine(line = {}, defaultKind = "supporting") {
  const out = [];
  const raw = Array.isArray(line.supporting_documents) ? line.supporting_documents : [];
  for (const d of raw) {
    if (!d || typeof d !== "object" || !d.path) continue;
    if (d.field) continue; // identity bag entry from legacy FE
    out.push({
      doc_kind: d.doc_kind || defaultKind,
      name: d.name || "Document",
      path: d.path,
      mime: d.mime || null,
    });
  }
  if (line.evidence_path) {
    out.push({
      doc_kind: "evidence",
      name: line.evidence_name || "Evidence",
      path: line.evidence_path,
      mime: null,
    });
  }
  if (line.report_path) {
    out.push({
      doc_kind: "report",
      name: line.report_name || "Report",
      path: line.report_path,
      mime: null,
    });
  }
  return out;
}

function activityFieldsFromLine(segment, line = {}) {
  const activity_type = resolveActivityType(segment, line);
  const identity = identityFromLine(line);
  const details = line.details && typeof line.details === "object" ? line.details : {};

  const base = {
    activity_type,
    enrolment_reference_id: line.enrolment_reference_id || line.enrolment_id || null,
    enrollee_name: line.enrollee_name || null,
    nhia_number: line.nhia_number || line.principle_nhia_number || null,
    program_name: (() => {
      const p = String(line.program_name || line.program || details.program || "").split("|")[0].trim();
      return p || null;
    })(),
    mda: line.mda || details.mda || null,
    request_date: line.request_date || line.record_date || null,
    process_end_date: line.process_end_date || null,
    activity_status: line.activity_status || line.line_status || details.status || "pending",
    remarks: line.remarks || details.remarks || null,
  };

  if (activity_type === "additional_dependant" || activity_type === "extra_dependant") {
    const request_kind = activity_type === "additional_dependant" ? "additional" : "extra";
    return {
      ...base,
      request_kind,
      dependant_entity: line.dependant_entity || line.relationship || null,
      relationship_kind: line.relationship_kind || null,
      hcf: identity.hcf,
      alternative_provider: identity.alternative_provider,
      surname: identity.surname,
      first_name: identity.first_name,
      middle_name: identity.middle_name,
      nin: identity.nin,
      blood_group: identity.blood_group,
      marital_status: identity.marital_status,
      state_of_origin: identity.state_of_origin,
      lga_of_origin: identity.lga_of_origin,
      state_of_residence: identity.state_of_residence,
      lga_of_residence: identity.lga_of_residence,
      phone_number: identity.phone_number,
      hmo_name: identity.hmo_name,
    };
  }

  if (activity_type === "hcp_change" || activity_type === "hmo_change") {
    const reason = line.reason_category != null
      ? { reason_category: line.reason_category, reason_other: line.reason_other || null }
      : unpackReason(line.reason_for_transfer);
    return {
      ...base,
      change_entity_type: activity_type === "hmo_change" ? "hmo" : "hcp",
      current_provider: line.current_provider || line.current_hcp_hmo || null,
      new_provider: line.new_provider || line.new_hcp_hmo || null,
      ...reason,
      met_criteria: line.met_criteria || null,
      record_date: line.record_date || line.request_date || null,
      program_name: base.program_name || details.program || null,
      mda: base.mda || details.mda || null,
    };
  }

  return {
    ...base,
    mda: line.mda || null,
    selection_date: line.selection_date || null,
    former_hmo: line.former_hmo || null,
    selected_hmo: line.selected_hmo || null,
    reason_for_change: line.reason_for_change || null,
    hmos_invited: optNum(line.hmos_invited),
    hmos_attended: optNum(line.hmos_attended),
    hmos_in_attendance: line.hmos_in_attendance || null,
    compliance_guideline: line.compliance_guideline || null,
    transparent_process: line.transparent_process || null,
  };
}

function syntheticLine(p, docs = []) {
  const { supporting_documents, evidence_path, evidence_name, report_path, report_name } = docsToArrays(docs);
  const at = p.activity_type;

  if (at === "additional_dependant" || at === "extra_dependant") {
    const program = p.program_name
      ? `${p.program_name}|${p.request_kind || (at === "additional_dependant" ? "additional" : "extra")}`
      : null;
    return {
      id: p.reference_id,
      report_id: p.reference_id,
      enrollee_name: p.enrollee_name,
      principle_nhia_number: p.nhia_number,
      nhia_number: p.nhia_number,
      relationship: p.dependant_entity,
      relationship_kind: p.relationship_kind,
      program,
      program_name: p.program_name,
      request_kind: p.request_kind,
      request_date: p.request_date,
      process_end_date: p.process_end_date,
      line_status: p.activity_status,
      activity_status: p.activity_status,
      enrolment_reference_id: p.enrolment_reference_id,
      hcf: p.hcf,
      alternative_provider: p.alternative_provider,
      surname: p.surname,
      first_name: p.first_name,
      middle_name: p.middle_name,
      nin: p.nin,
      blood_group: p.blood_group,
      marital_status: p.marital_status,
      state_of_origin: p.state_of_origin,
      lga_of_origin: p.lga_of_origin,
      state_of_residence: p.state_of_residence,
      lga_of_residence: p.lga_of_residence,
      phone_number: p.phone_number,
      hmo_name: p.hmo_name,
      supporting_documents,
      remarks: p.remarks,
    };
  }

  if (at === "hcp_change" || at === "hmo_change") {
    return {
      id: p.reference_id,
      report_id: p.reference_id,
      record_date: p.record_date,
      enrollee_name: p.enrollee_name,
      nhia_number: p.nhia_number,
      entity_type: p.change_entity_type,
      current_hcp_hmo: p.current_provider,
      new_hcp_hmo: p.new_provider,
      current_provider: p.current_provider,
      new_provider: p.new_provider,
      reason_for_transfer: packReason(p.reason_category, p.reason_other),
      reason_category: p.reason_category,
      reason_other: p.reason_other,
      met_criteria: p.met_criteria,
      request_date: p.request_date,
      process_end_date: p.process_end_date,
      line_status: p.activity_status,
      enrolment_reference_id: p.enrolment_reference_id,
      supporting_documents,
      details: { program: p.program_name, mda: p.mda },
      remarks: p.remarks,
    };
  }

  return {
    id: p.reference_id,
    report_id: p.reference_id,
    mda: p.mda,
    selection_date: p.selection_date,
    hmos_in_attendance: p.hmos_in_attendance,
    former_hmo: p.former_hmo,
    reason_for_change: p.reason_for_change,
    hmos_invited: p.hmos_invited,
    hmos_attended: p.hmos_attended,
    compliance_guideline: p.compliance_guideline,
    transparent_process: p.transparent_process,
    selected_hmo: p.selected_hmo,
    evidence_path,
    evidence_name,
    report_path,
    report_name,
    supporting_documents,
    details: { status: p.activity_status, remarks: p.remarks },
    line_status: p.activity_status,
    remarks: p.remarks,
  };
}

async function mapReport(row) {
  const p = row.toJSON ? row.toJSON() : { ...row };
  const docs = await listDocuments(BM_FORM_KEY, p.reference_id);
  return {
    ...p,
    id: p.reference_id,
    zone_id: p.zonal_code,
    state_id: p.state_code,
    endorsed: !!p.endorsed,
    zone: p.zone
      ? { ...p.zone, id: p.zone.zonal_code || p.zonal_code, description: p.zone.description }
      : undefined,
    state: p.state
      ? { ...p.state, id: p.state.code || p.state_code, description: p.state.description }
      : undefined,
    lines: [syntheticLine(p, docs)],
  };
}

const reportIncludes = [
  { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
  { model: StateOffice, as: "state", attributes: ["code", "description"] },
];

async function findReport(referenceId) {
  return BeneficiaryManagementReport.findByPk(referenceId, {
    include: reportIncludes,
  });
}

async function replaceDocuments(referenceId, docs) {
  return replaceFormDocuments(BM_FORM_KEY, referenceId, docs);
}

async function appendDocuments(referenceId, docs) {
  return appendFormDocuments(BM_FORM_KEY, referenceId, docs);
}

async function nextReferenceId(activityType) {
  const year = new Date().getFullYear();
  const prefix = prefixFor(activityType);
  const fullPrefix = `${prefix}-${year}-`;
  const last = await BeneficiaryManagementReport.findOne({
    where: { reference_id: { [Op.like]: `${fullPrefix}%` } },
    order: [["reference_id", "DESC"]],
  });
  let next = 1;
  if (last?.reference_id) {
    const n = parseInt(String(last.reference_id).slice(fullPrefix.length), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${fullPrefix}${String(next).padStart(5, "0")}`;
}

const isCoordinatorRole = (role) => /(^|-)(state|zonal)-coordinator$/.test(String(role || ""));

async function patchBeneficiaryStatus(req, report) {
  const { status, review_note: reviewNote, action } = req.body || {};
  const role = String(req.user?.role || "");
  const reviewer = role === "admin" || isCoordinatorRole(role) || await canReviewMonthlyReport(role);
  const note = reviewNote && String(reviewNote).trim() ? String(reviewNote).trim() : "";
  const reviewerName = req.user?.name || req.user?.staff_id || "Reviewer";

  if (action === "endorse" || action === "return") {
    if (!reviewer) {
      const err = new Error("Only a state coordinator can endorse or return this report");
      err.status = 403;
      throw err;
    }
    if (report.status !== "submitted") {
      const err = new Error("Only reports sent for review can be endorsed or returned");
      err.status = 422;
      throw err;
    }
    if (!note) {
      const err = new Error(action === "endorse"
        ? "A comment is required to endorse"
        : "A comment is required when returning a report");
      err.status = 422;
      throw err;
    }
    await report.update({
      status: "draft",
      endorsed: action === "endorse",
      coordinator_review_note: note,
      coordinator_reviewed_by: reviewerName,
      coordinator_reviewed_at: new Date(),
    });
    return;
  }

  if (action === "final_submit" || status === "approved") {
    if (!report.endorsed) {
      const err = new Error("The state coordinator must endorse this report before final submission");
      err.status = 422;
      throw err;
    }
    await report.update({ status: "approved" });
    return;
  }

  if (status === "submitted") {
    await report.update({
      status: "submitted",
      endorsed: false,
      coordinator_review_note: null,
      coordinator_reviewed_by: null,
      coordinator_reviewed_at: null,
    });
    return;
  }

  if (status === "draft") {
    await report.update({ status: "draft" });
    return;
  }

  const err = new Error("Send the report for review from the form");
  err.status = 422;
  throw err;
}

function makeSegmentController(segment) {
  const allowedTypes = SEGMENT_ACTIVITY_TYPES[segment] || [];

  const listReports = async (req, res, next) => {
    try {
      const where = { activity_type: { [Op.in]: allowedTypes } };
      const zonal = req.query.zonal_code || req.query.zone_id;
      const state = req.query.state_code || req.query.state_id;
      if (zonal) where.zonal_code = zonal;
      if (state) where.state_code = state;
      if (req.query.year || req.query.reporting_year) {
        where.reporting_year = Number(req.query.year || req.query.reporting_year);
      }
      if (req.query.month || req.query.reporting_month) {
        where.reporting_month = Number(req.query.month || req.query.reporting_month);
      }
      if (req.query.status) where.status = req.query.status;

      if (!zonal && req.user?.zonal_code && !["sdo", "dg-ceo", "hq-department"].includes(req.user.role)) {
        where.zonal_code = req.user.zonal_code;
      }
      if (!state && req.user?.state_code && String(req.user.role || "").includes("state")) {
        where.state_code = req.user.state_code;
      }

      const rows = await BeneficiaryManagementReport.findAll({
        where,
        include: reportIncludes,
        order: [["reporting_year", "DESC"], ["reporting_month", "DESC"], ["reference_id", "DESC"]],
      });
      const data = [];
      for (const r of rows) data.push(await mapReport(r));
      res.json({ success: true, data });
    } catch (err) { next(err); }
  };

  const getReport = async (req, res, next) => {
    try {
      const row = await findReport(req.params.id);
      if (!row || !allowedTypes.includes(row.activity_type)) {
        return res.status(404).json({ success: false, message: "Report not found" });
      }
      res.json({ success: true, data: await mapReport(row) });
    } catch (err) { next(err); }
  };

  const createReport = async (req, res, next) => {
    try {
      const body = req.body || {};
      const geo = geoFromBody(req.user, body);
      if (!geo.zonal_code || !geo.state_code) {
        return res.status(422).json({ success: false, message: "Zone and state are required" });
      }
      const reporting_year = Number(body.reporting_year);
      const reporting_month = Number(body.reporting_month);
      if (!reporting_year || !reporting_month || reporting_month < 1 || reporting_month > 12) {
        return res.status(422).json({ success: false, message: "Valid reporting year and month are required" });
      }

      let status = body.status || "draft";
      if (status === "approved") {
        return res.status(422).json({
          success: false,
          message: "Send the report for review. Final approval follows the state coordinator's endorsement.",
        });
      }

      const rawLines = Array.isArray(body.lines) && body.lines.length ? body.lines : [body];
      const created = [];
      for (const line of rawLines) {
        const fields = activityFieldsFromLine(segment, line);
        if (!allowedTypes.includes(fields.activity_type)) continue;
        const reference_id = await nextReferenceId(fields.activity_type);
        const row = await BeneficiaryManagementReport.create({
          reference_id,
          ...geo,
          reporting_year,
          reporting_month,
          submission_date: body.submission_date || null,
          submitted_by: body.submitted_by || req.user?.name || null,
          status,
          endorsed: false,
          quarter: quarterFromMonth(reporting_month),
          created_by_user_id: req.user?.id || null,
          ...fields,
        });
        const docs = docsFromLine(line, segment === "hmo-selection" ? "supporting" : "supporting");
        if (docs.length) await replaceDocuments(reference_id, docs);
        created.push(row);
      }

      if (!created.length) {
        return res.status(422).json({ success: false, message: "At least one valid activity line is required" });
      }

      const full = await findReport(created[0].reference_id);
      res.status(201).json({ success: true, data: await mapReport(full) });
    } catch (err) { next(err); }
  };

  const updateReport = async (req, res, next) => {
    try {
      const report = await BeneficiaryManagementReport.findByPk(req.params.id);
      if (!report || !allowedTypes.includes(report.activity_type)) {
        return res.status(404).json({ success: false, message: "Report not found" });
      }

      const body = req.body || {};
      if (body.status === "approved" && !report.endorsed) {
        return res.status(422).json({
          success: false,
          message: "The state coordinator must endorse this report before final submission.",
        });
      }

      const geo = geoFromBody(req.user, body);
      const reporting_year = body.reporting_year != null
        ? Number(body.reporting_year) : report.reporting_year;
      const reporting_month = body.reporting_month != null
        ? Number(body.reporting_month) : report.reporting_month;

      const rawLines = Array.isArray(body.lines) ? body.lines : null;
      let activityPatch = {};
      let docsPatch = null;

      if (rawLines && rawLines.length) {
        const match = rawLines.find((l) =>
          String(l.id || l.reference_id || "") === String(report.reference_id)
        ) || rawLines[0];
        activityPatch = activityFieldsFromLine(segment, match);
        docsPatch = docsFromLine(match);

        for (const line of rawLines) {
          const lineId = String(line.id || line.reference_id || "");
          if (lineId && lineId === String(report.reference_id)) continue;
          if (lineId) {
            const existing = await BeneficiaryManagementReport.findByPk(lineId);
            if (existing && allowedTypes.includes(existing.activity_type)) {
              const fields = activityFieldsFromLine(segment, line);
              await existing.update({
                ...fields,
                reporting_year,
                reporting_month,
                quarter: quarterFromMonth(reporting_month),
                status: body.status === "submitted" ? "submitted" : (body.status || existing.status),
                endorsed: body.status === "submitted" ? false : existing.endorsed,
              });
              await replaceDocuments(existing.reference_id, docsFromLine(line));
              continue;
            }
          }
          const fields = activityFieldsFromLine(segment, line);
          if (!allowedTypes.includes(fields.activity_type)) continue;
          const reference_id = await nextReferenceId(fields.activity_type);
          await BeneficiaryManagementReport.create({
            reference_id,
            zonal_code: geo.zonal_code || report.zonal_code,
            state_code: geo.state_code || report.state_code,
            department_code: geo.department_code ?? report.department_code,
            unit_code: geo.unit_code ?? report.unit_code,
            reporting_year,
            reporting_month,
            submission_date: body.submission_date !== undefined
              ? body.submission_date : report.submission_date,
            submitted_by: body.submitted_by !== undefined
              ? body.submitted_by : report.submitted_by,
            status: body.status || report.status,
            endorsed: false,
            quarter: quarterFromMonth(reporting_month),
            created_by_user_id: req.user?.id || null,
            ...fields,
          });
          const docs = docsFromLine(line);
          if (docs.length) await replaceDocuments(reference_id, docs);
        }
      }

      const statusPatch = {};
      if (body.status === "submitted") {
        statusPatch.status = "submitted";
        statusPatch.endorsed = false;
        statusPatch.coordinator_review_note = null;
        statusPatch.coordinator_reviewed_by = null;
        statusPatch.coordinator_reviewed_at = null;
      } else if (body.status) {
        statusPatch.status = body.status;
      }

      await report.update({
        zonal_code: geo.zonal_code || report.zonal_code,
        state_code: geo.state_code || report.state_code,
        department_code: geo.department_code ?? report.department_code,
        unit_code: geo.unit_code ?? report.unit_code,
        reporting_year,
        reporting_month,
        submission_date: body.submission_date !== undefined
          ? body.submission_date : report.submission_date,
        submitted_by: body.submitted_by !== undefined
          ? body.submitted_by : report.submitted_by,
        quarter: quarterFromMonth(reporting_month),
        ...activityPatch,
        ...statusPatch,
      });

      if (docsPatch) await replaceDocuments(report.reference_id, docsPatch);

      const full = await findReport(report.reference_id);
      res.json({ success: true, data: await mapReport(full) });
    } catch (err) { next(err); }
  };

  const updateStatus = async (req, res, next) => {
    try {
      const report = await BeneficiaryManagementReport.findByPk(req.params.id);
      if (!report || !allowedTypes.includes(report.activity_type)) {
        return res.status(404).json({ success: false, message: "Report not found" });
      }
      try {
        await patchBeneficiaryStatus(req, report);
      } catch (e) {
        return res.status(e.status || 500).json({ success: false, message: e.message });
      }
      const full = await findReport(report.reference_id);
      res.json({ success: true, data: await mapReport(full) });
    } catch (err) { next(err); }
  };

  const uploadLineFiles = async (req, res, next) => {
    try {
      const targetId = req.params.lineId || req.params.id;
      let report = await BeneficiaryManagementReport.findByPk(targetId);
      if (!report || !allowedTypes.includes(report.activity_type)) {
        report = await BeneficiaryManagementReport.findByPk(req.params.id);
      }
      if (!report || !allowedTypes.includes(report.activity_type)) {
        return res.status(404).json({ success: false, message: "Report not found" });
      }
      const files = req.files || [];
      if (!files.length && !req.file) {
        return res.status(422).json({ success: false, message: "No file uploaded" });
      }
      const kind = String(req.body?.kind || req.query?.kind || "supporting");
      const docKind = ["evidence", "report", "supporting"].includes(kind) ? kind : "supporting";
      const list = files.length ? files : [req.file];
      const added = list.filter(Boolean).map((f) => ({
        doc_kind: docKind,
        name: f.originalname,
        path: `/uploads/beneficiary/${f.filename}`,
        mime: f.mimetype || null,
      }));
      await appendDocuments(report.reference_id, added);
      const full = await findReport(report.reference_id);
      const mapped = await mapReport(full);
      res.json({ success: true, data: mapped.lines[0] });
    } catch (err) { next(err); }
  };

  return {
    listReports,
    getReport,
    createReport,
    updateReport,
    updateStatus,
    uploadLineFiles,
  };
}

const controllersBySegment = Object.fromEntries(
  BENEFICIARY_SEGMENTS.map((s) => [s, makeSegmentController(s)]),
);

module.exports = {
  makeSegmentController,
  controllersBySegment,
  BENEFICIARY_SEGMENTS,
};
