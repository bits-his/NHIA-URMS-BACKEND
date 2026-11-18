/**
 * Paint-ready Enrolment Activity dashboard data.
 * Fills the gaps the other enrolment seeds leave empty: ID cards, NIN checks,
 * TISHIP/OPS volume, channel/mode/funding mix, and a few incomplete offices.
 * Idempotent — replaces only ENR-VIS-* rows.
 *
 *   node src/scripts/seedEnrolmentDashboardDemo.js
 *   npm run db:seed-enrolment-dashboard
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { EnrolmentReport, StateOffice } = require("../models");

const now = new Date();
const YEAR = now.getFullYear();
const LAST_MONTH = now.getMonth() + 1;
const PREFIX = "ENR-VIS";

const PROGRAMS = [
  { code: "PRG-0001", name: "FSSHIP", mode: "Walk-in Registration", channel: "NHIA", fund: "Zero-Cost (Statutory Mandate)", type: "Fresh Enrolment" },
  { code: "PRG-0001", name: "FSSHIP", mode: "Mop-up enrolment", channel: "NHIA", fund: "Zero-Cost (Statutory Mandate)", type: "Fresh Enrolment" },
  { code: "PRG-0003", name: "OPS", mode: "Field Registration", channel: "NHIA", fund: "Budgeted (Approved Release)", type: "Fresh Enrolment" },
  { code: "PRG-BHCPF", name: "BHCPF", mode: "BHCPF Enrolment", channel: "SSHIA", fund: "Zero-Cost (Statutory Mandate)", type: "Fresh Enrolment" },
  { code: "PRG-TISHIP", name: "TISHIP", mode: "Institutional Enrolment", channel: "Equity Program", fund: "Budgeted (Approved Release)", type: "Fresh Enrolment" },
  { code: "PRG-0005", name: "GIFSHIP-G", mode: "Group Registration", channel: "NHIA", fund: "Budgeted (Approved Release)", type: "Fresh Enrolment" },
  { code: "PRG-0007", name: "GIFSHIP-C", mode: "Constituency Project", channel: "NHIA", fund: "Budgeted (Approved Release)", type: "Fresh Enrolment" },
  { code: "PRG-0008", name: "GIFSHIP-R", mode: "Walk-in registration", channel: "NHIA", fund: "Zero-Cost (Statutory Mandate)", type: "Renewal" },
];

const FIRST = ["Adaobi", "Chinedu", "Yusuf", "Aisha", "Tunde", "Ngozi", "Ibrahim", "Fatima", "Grace", "Emeka"];
const SURN = ["Okeke", "Bello", "Musa", "Adeyemi", "Okonkwo", "Lawal", "Danladi", "Eze", "Balogun", "Okafor"];

const pad = (n, w = 2) => String(n).padStart(w, "0");
const isoDay = (y, m, d) => `${y}-${pad(m)}-${pad(Math.min(28, d))}`;

function pick(arr, i) {
  return arr[i % arr.length];
}

function volume(stateIndex, month, programIndex) {
  const base = 18 + ((stateIndex * 7 + month * 3 + programIndex * 5) % 55);
  if (programIndex % 8 === 3) return base + 40; // BHCPF a bit heavier
  if (programIndex % 8 === 4) return Math.max(12, Math.round(base * 0.6)); // TISHIP lighter
  return base;
}

async function main() {
  await sequelize.authenticate();
  if (!EnrolmentReport) throw new Error("EnrolmentReport not loaded");

  const states = await StateOffice.findAll({ order: [["zonal_code", "ASC"], ["code", "ASC"]] });
  if (!states.length) throw new Error("No state_offices — seed zones/states first");

  const cleared = await EnrolmentReport.destroy({ where: { reference_id: { [Op.like]: `${PREFIX}-%` } } });
  if (cleared) console.log(`Cleared ${cleared} previous ${PREFIX} rows`);

  const rows = [];
  const months = Array.from({ length: Math.min(6, LAST_MONTH) }, (_, i) => LAST_MONTH - i).reverse();
  let seq = 0;

  states.forEach((state, si) => {
    // A few offices intentionally miss an activity type so reporting completeness is not 100%.
    const skipCards = si % 7 === 0;
    const skipNin = si % 5 === 0;
    const weakMonth = months[months.length - 1];

    months.forEach((month, mi) => {
      const status = month < LAST_MONTH - 1 ? "approved" : (si % 4 === 3 && month === LAST_MONTH ? "draft" : "submitted");
      const submitDay = month === LAST_MONTH && status === "draft" ? null : isoDay(YEAR, month, 20 + (si % 8));

      // Two enrolment programme rows per month keep charts filled without flooding.
      for (let p = 0; p < 2; p += 1) {
        const prog = pick(PROGRAMS, si + month + p * 3);
        seq += 1;
        const count = volume(si, month, si + p + month);
        rows.push({
          reference_id: `${PREFIX}-ENR-${YEAR}${pad(month)}${state.code}${pad(seq, 3)}`.slice(0, 30),
          zonal_code: state.zonal_code,
          state_code: state.code,
          reporting_year: YEAR,
          reporting_month: month,
          quarter: Math.ceil(month / 3),
          submission_date: submitDay,
          submitted_by: "State Office Officer",
          status: month === weakMonth && si % 6 === 1 ? "draft" : status,
          category: "enrolment",
          activity_code: "ENR-0001",
          activity_date: isoDay(YEAR, month, 4 + p * 5 + (si % 4)),
          enrolment_channel: prog.channel,
          enrolment_type: prog.type,
          program_code: prog.code,
          program_name: prog.name,
          enrolment_category: prog.mode,
          beneficiary_category: prog.name.startsWith("GIFSHIP") ? "Group (GIFSHIP, GIFSHIP-R)" : "Principal (FSSHIP)",
          beneficiary_status: "Active",
          funding_option: prog.fund,
          supporting_evidence: "Enrolment register",
          enrolment_count: count,
          activity_status: "Completed",
          remarks: `${prog.name} enrolment — ${state.description}`,
          program_details: prog.name.startsWith("GIFSHIP")
            ? {
              surname: pick(SURN, si + p),
              first_name: pick(FIRST, month + p),
              phone_number: `080${pad((si * 1000 + month * 10 + p) % 100000000, 8)}`,
              registration_date: isoDay(YEAR, month, 3 + p),
              expiry_date: isoDay(YEAR + 1, ((month + 1) % 12) + 1, 10 + p),
              renewal_status: "Not Yet Due",
            }
            : prog.name === "TISHIP"
              ? { institution_name: `${state.description} Polytechnic`, students_enrolled: count }
              : prog.name === "BHCPF"
                ? { sshia_name: `${state.description} SSHIA`, number_enrolled: count }
                : {
                  surname: pick(SURN, si + p),
                  first_name: pick(FIRST, month + p),
                  organization_mda: `${state.description} Civil Service`,
                },
        });
      }

      // Skip ID-card / NIN on the weak month for some offices so completeness varies.
      if (!(skipCards && month === weakMonth)) {
        seq += 1;
        const pending = (si + month) % 3 !== 0;
        const cardCount = 4 + ((si + month) % 9);
        rows.push({
          reference_id: `${PREFIX}-IDC-${YEAR}${pad(month)}${state.code}${pad(seq, 3)}`.slice(0, 30),
          zonal_code: state.zonal_code,
          state_code: state.code,
          reporting_year: YEAR,
          reporting_month: month,
          quarter: Math.ceil(month / 3),
          submission_date: submitDay,
          submitted_by: "State Office Officer",
          status,
          category: "id_card_issuance",
          activity_code: "ENR-0003",
          activity_date: isoDay(YEAR, month, pending ? 2 + (si % 10) : 12 + (si % 8)),
          enrolment_channel: "NHIA",
          program_name: pick(["FSSHIP", "GIFSHIP-G", "OPS", "BHCPF"], si + month),
          enrolment_count: cardCount,
          activity_status: pending ? "Pending" : "Issued",
          program_details: {
            enrollee_name: `${pick(SURN, si + month)} ${pick(FIRST, si)}`,
            nhia_number: `NHIA-${state.code}-${pad(month)}${pad(si, 2)}`,
            request_category: (si + month) % 2 === 0 ? "Issuance (New enrolees)" : "Replacement (Existing enrolees)",
            id_card_status: pending ? "Pending" : "Issued",
            issue_date: pending ? null : isoDay(YEAR, month, 15),
            phone_number: `081${pad((si * 77 + month) % 100000000, 8)}`,
          },
        });
      }

      // Keep NIN checks in the current month and every other earlier month.
      if (!(skipNin && month === weakMonth) && (month === LAST_MONTH || mi % 2 === 0)) {
        seq += 1;
        const checked = 20 + ((si + month) % 40);
        const validated = Math.round(checked * (0.7 + ((si + month) % 3) * 0.08));
        rows.push({
          reference_id: `${PREFIX}-NIN-${YEAR}${pad(month)}${state.code}${pad(seq, 3)}`.slice(0, 30),
          zonal_code: state.zonal_code,
          state_code: state.code,
          reporting_year: YEAR,
          reporting_month: month,
          quarter: Math.ceil(month / 3),
          submission_date: submitDay,
          submitted_by: "State Office Officer",
          status,
          category: "nin_validation",
          activity_code: "ENR-0002",
          activity_date: isoDay(YEAR, month, 8),
          enrolment_channel: "NHIA",
          program_name: "FSSHIP",
          enrolment_count: checked,
          enrollees_validated: validated,
          activity_status: "Validated",
          program_details: {
            enrollee_name: `${pick(SURN, month)} ${pick(FIRST, si + 2)}`,
            nin_number: `${pad(si + 1, 2)}${pad(month, 2)}${pad(checked, 7)}`.slice(0, 11),
            validation_status: "Validated",
          },
        });
      }

      if (mi === months.length - 1 && si % 3 === 0) {
        seq += 1;
        rows.push({
          reference_id: `${PREFIX}-VAL-${YEAR}${pad(month)}${state.code}${pad(seq, 3)}`.slice(0, 30),
          zonal_code: state.zonal_code,
          state_code: state.code,
          reporting_year: YEAR,
          reporting_month: month,
          quarter: Math.ceil(month / 3),
          submission_date: submitDay,
          submitted_by: "State Office Officer",
          status,
          category: "validation_of_enrolees",
          activity_code: "ENR-0004",
          activity_date: isoDay(YEAR, month, 16),
          enrolment_channel: "NHIA",
          program_name: "FSSHIP",
          enrolment_count: 10 + (si % 12),
          enrollees_validated: 8 + (si % 10),
          activity_status: "Completed",
          program_details: { remarks: "Register completeness check" },
        });
      }
    });
  });

  for (let i = 0; i < rows.length; i += 150) {
    await EnrolmentReport.bulkCreate(rows.slice(i, i + 150), { logging: false });
  }

  const [summary] = await sequelize.query(`
    SELECT category, COUNT(*) AS n, COALESCE(SUM(enrolment_count),0) AS vol
    FROM enrolment_reports
    WHERE reference_id LIKE '${PREFIX}-%'
    GROUP BY category
    ORDER BY category
  `);
  console.log(`\nSeeded ${rows.length} enrolment dashboard rows across ${states.length} states (${YEAR}, months ${months.join(",")})`);
  summary.forEach((row) => console.log(`  ${row.category}: ${row.n} rows · volume ${row.vol}`));
  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err);
  try { await sequelize.close(); } catch { /* ignore */ }
  process.exit(1);
});
