/**
 * Helpers for the shared form_documents table.
 */
const FormDocument = require("../models/shared/FormDocument");

async function listDocuments(formKey, reportReferenceId) {
  return FormDocument.findAll({
    where: { form_key: formKey, report_reference_id: reportReferenceId },
    order: [["sn", "ASC"]],
  });
}

async function replaceDocuments(formKey, reportReferenceId, docs = []) {
  await FormDocument.destroy({
    where: { form_key: formKey, report_reference_id: reportReferenceId },
  });
  let sn = 1;
  for (const d of docs) {
    if (!d?.path) continue;
    await FormDocument.create({
      form_key: formKey,
      report_reference_id: reportReferenceId,
      sn: sn++,
      doc_kind: d.doc_kind || "supporting",
      name: d.name || "Document",
      path: d.path,
      mime: d.mime || null,
    });
  }
}

async function appendDocuments(formKey, reportReferenceId, docs = []) {
  const maxSn = await FormDocument.max("sn", {
    where: { form_key: formKey, report_reference_id: reportReferenceId },
  });
  let sn = Number(maxSn) || 0;
  for (const d of docs) {
    if (!d?.path) continue;
    sn += 1;
    await FormDocument.create({
      form_key: formKey,
      report_reference_id: reportReferenceId,
      sn,
      doc_kind: d.doc_kind || "supporting",
      name: d.name || "Document",
      path: d.path,
      mime: d.mime || null,
    });
  }
}

async function deleteDocumentsForReport(formKey, reportReferenceId) {
  await FormDocument.destroy({
    where: { form_key: formKey, report_reference_id: reportReferenceId },
  });
}

function docsToArrays(docs = []) {
  const supporting_documents = [];
  let evidence_path = null;
  let evidence_name = null;
  let report_path = null;
  let report_name = null;
  for (const d of docs) {
    const row = d.toJSON ? d.toJSON() : d;
    if (row.doc_kind === "evidence") {
      evidence_path = row.path;
      evidence_name = row.name;
    } else if (row.doc_kind === "report") {
      report_path = row.path;
      report_name = row.name;
    } else {
      supporting_documents.push({
        name: row.name,
        path: row.path,
        mime: row.mime || undefined,
      });
    }
  }
  return { supporting_documents, evidence_path, evidence_name, report_path, report_name };
}

module.exports = {
  listDocuments,
  replaceDocuments,
  appendDocuments,
  deleteDocumentsForReport,
  docsToArrays,
};
