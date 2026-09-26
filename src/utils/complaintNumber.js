/**
 * Complaint IDs: ENF/{HCF|HMO|ENR}/{STATE}/{MON} {YY}/{seq}
 * e.g. ENF/HCF/TAR/SEP 26/001
 * Sequence resets each month per state + respondent party.
 */
const { Op } = require("sequelize");
const StateOffice = require("../models/StateOffice");

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function partyCode(against) {
  const p = String(against || "").trim();
  if (/^enrollee$/i.test(p)) return "ENR";
  if (/^hmo$/i.test(p)) return "HMO";
  if (/^hcf$/i.test(p) || /^healthcare facility$/i.test(p)) return "HCF";
  return (p.slice(0, 3).toUpperCase() || "HCF");
}

function stateCodeFromOffice(state) {
  const raw = String(state?.code || "").trim().toUpperCase();
  if (raw && !/^SO-?\d+$/i.test(raw)) {
    return raw.replace(/[^A-Z0-9]/g, "").slice(0, 3) || "ST";
  }
  const fromName = String(state?.description || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return fromName.slice(0, 3) || "ST";
}

function monthYearParts(dateReceived) {
  const d = dateReceived ? new Date(dateReceived) : new Date();
  const valid = !Number.isNaN(d.getTime()) ? d : new Date();
  return {
    mon: MONTH_ABBR[valid.getMonth()],
    yy: String(valid.getFullYear()).slice(-2),
    month: valid.getMonth() + 1,
    year: valid.getFullYear(),
  };
}

function complaintNumberPrefix(against, stateCode, dateReceived) {
  const { mon, yy } = monthYearParts(dateReceived);
  return `ENF/${partyCode(against)}/${stateCode}/${mon} ${yy}`;
}

function previewComplaintNumber(against, stateCode, dateReceived) {
  const code = String(stateCode || "").trim().toUpperCase() || "…";
  return `${complaintNumberPrefix(against, code === "…" ? "…" : code, dateReceived)}/…`;
}

async function nextComplaintNumber({ against, stateId, dateReceived, sequelizeModel, transaction }) {
  const state = stateId ? await StateOffice.findByPk(stateId, { transaction }) : null;
  const stateCode = stateCodeFromOffice(state);
  const prefix = complaintNumberPrefix(against || "HCF", stateCode, dateReceived);
  const like = `${prefix}/%`;
  const rows = await sequelizeModel.findAll({
    attributes: ["complaint_number"],
    where: { complaint_number: { [Op.like]: like } },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  let maxSeq = 0;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}/(\\d+)$`);
  for (const row of rows) {
    const match = String(row.get("complaint_number") || "").match(re);
    if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
  }
  return `${prefix}/${String(maxSeq + 1).padStart(3, "0")}`;
}

module.exports = {
  partyCode,
  stateCodeFromOffice,
  monthYearParts,
  complaintNumberPrefix,
  previewComplaintNumber,
  nextComplaintNumber,
};
