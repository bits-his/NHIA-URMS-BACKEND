/**
 * Seed GIFSHIP renewal records for the Enrolment dashboard (Renewals face).
 * Per state, per month up to the current month:
 *   - fresh GIFSHIP enrolments (dates follow the form: effective +60d, expiry +1y, window expiry −2m)
 *   - renewals completed for members whose term expired that month
 *   - overdue renewals (term expired, not yet renewed) — heavier in some states
 *   - renewals in progress for members expiring in the next 60 days
 * Idempotent: replaces only ENR-RNW-* rows.
 *
 *   node src/scripts/seedEnrolmentRenewalsDemo.js [--year 2026]
 *   npm run db:seed-enrolment-renewals
 */
require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { EnrolmentReport, StateOffice } = require("../models");

const yearArg = process.argv.indexOf("--year");
const now = new Date();
const YEAR = Number(yearArg > -1 ? process.argv[yearArg + 1] : now.getFullYear()) || now.getFullYear();
const LAST_MONTH = YEAR < now.getFullYear() ? 12 : now.getMonth() + 1;

const FIRST = ["Adaobi", "Chinedu", "Yusuf", "Aisha", "Tunde", "Ngozi", "Ibrahim", "Fatima", "Grace", "Emeka", "Amina", "Bello", "Chioma", "Sani", "Halima", "Oluwaseun", "Zainab", "Kelechi", "Hauwa", "Segun"];
const SURN = ["Okeke", "Bello", "Musa", "Adeyemi", "Okonkwo", "Lawal", "Danladi", "Eze", "Balogun", "Okafor", "Usman", "Nwosu", "Abdullahi", "Ibrahim", "Ojo", "Suleiman", "Garba", "Onyeka", "Yakubu", "Afolabi"];
const HMOS = ["Hygeia HMO", "AIICO Multishield", "Avon HMO", "Leadway Health", "Reliance HMO"];
const PROGRAMS = [
  { code: "PRG-0005", name: "GIFSHIP-G", mode: "Group Registration", category: "Group (GIFSHIP, GIFSHIP-R)", sponsor: (s) => `${s} Traders Cooperative` },
  { code: "PRG-0007", name: "GIFSHIP-C", mode: "Constituency Project", category: "Individual (GIFSHIP)", sponsor: (s) => `${s} Constituency Health Project` },
  { code: "PRG-0008", name: "GIFSHIP-R", mode: "Walk-in registration", category: "Group (GIFSHIP, GIFSHIP-R)", sponsor: (s) => `${s} Retirees Association` },
];

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (s) => new Date(`${s}T12:00:00`);
const addDays = (s, n) => { const d = at(s); d.setDate(d.getDate() + n); return iso(d); };
const addMonths = (s, n) => { const d = at(s); d.setMonth(d.getMonth() + n); return iso(d); };
const TODAY = iso(now);

function rand(seed) {
  let x = 0;
  for (const ch of seed) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}

/** Same rules as the enrolment form (computeGifshipDates). */
function termFrom(registration_date) {
  const enrolment_date_auto = addDays(registration_date, 60);
  const expiry_date = addMonths(enrolment_date_auto, 12);
  const renewal_date = addMonths(expiry_date, -2);
  let renewal_status = "Not Yet Due";
  if (TODAY > expiry_date) renewal_status = "Overdue";
  else if (TODAY >= renewal_date) renewal_status = "Due Soon";
  return { registration_date, enrolment_date_auto, expiry_date, renewal_date, renewal_status };
}

function person(r, state, prog) {
  const first = FIRST[Math.floor(r() * FIRST.length)];
  const surname = SURN[Math.floor(r() * SURN.length)];
  const details = {
    surname,
    first_name: first,
    nin: String(10000000000 + Math.floor(r() * 89999999999)).slice(0, 11),
    program_type: prog.name,
    state_of_origin: state.description,
    state_of_residence: state.description,
    hmo: HMOS[Math.floor(r() * HMOS.length)],
    hcf: `${state.description} General Hospital`,
    sponsor_name: prog.sponsor(state.description),
    sponsor_phone: `080${String(Math.floor(r() * 1e8)).padStart(8, "0")}`,
  };
  if (prog.name === "GIFSHIP-C") details.project_community_name = `${state.description} Central Community`;
  return details;
}

async function main() {
  await sequelize.authenticate();
  if (!EnrolmentReport) throw new Error("EnrolmentReport not loaded — ensure APPROVED_FORMS.enrolment is set");

  const states = await StateOffice.findAll({ order: [["zonal_code", "ASC"], ["code", "ASC"]] });
  if (!states.length) throw new Error("No state_offices — seed zones/states first");

  const cleared = await EnrolmentReport.destroy({ where: { reference_id: { [Op.like]: "ENR-RNW-%" } } });
  if (cleared) console.log(`Cleared ${cleared} previous ENR-RNW rows`);

  const rows = [];
  const totals = { fresh: 0, renewed: 0, overdue: 0, due: 0 };

  states.forEach((state, si) => {
    const backlog = si % 4 === 0; // roughly a quarter of states carry a renewal backlog
    for (let month = 1; month <= LAST_MONTH; month += 1) {
      const r = rand(`${state.code}-${YEAR}-${month}`);
      const status = month <= LAST_MONTH - 2 ? "approved" : "submitted";
      const reportDay = Math.min(28, 6 + Math.floor(r() * 18));
      const activity_date = `${YEAR}-${pad(month)}-${pad(reportDay)}`;
      const submission_date = month === LAST_MONTH && YEAR === now.getFullYear()
        ? TODAY
        : addDays(`${YEAR}-${pad(month)}-01`, 31 + Math.floor(r() * 4));
      let seq = 0;

      const push = (kind, prog, count, enrolment_type, activity_status, beneficiary_status, term, remarks) => {
        seq += 1;
        totals[kind] += count;
        rows.push({
          reference_id: `ENR-RNW-${YEAR}-${state.code}-${pad(month)}-${pad(seq)}`.slice(0, 30),
          zonal_code: state.zonal_code,
          state_code: state.code,
          reporting_year: YEAR,
          reporting_month: month,
          quarter: Math.ceil(month / 3),
          submission_date: submission_date > TODAY ? TODAY : submission_date,
          submitted_by: "State Office Officer",
          status,
          category: "enrolment",
          activity_code: "ENR-0001",
          activity_date,
          enrolment_channel: "NHIA",
          enrolment_type,
          program_code: prog.code,
          program_name: prog.name,
          enrolment_category: prog.mode,
          beneficiary_category: prog.category,
          beneficiary_status,
          funding_option: "Budgeted (Approved Release)",
          supporting_evidence: "Payment Schedule",
          enrolment_count: count,
          activity_status,
          remarks,
          program_details: { ...person(r, state, prog), ...term },
        });
      };

      // Fresh enrolments registered this month
      const freshProg = PROGRAMS[(si + month) % PROGRAMS.length];
      push("fresh", freshProg, 15 + Math.floor(r() * 30), "Fresh Enrolment", "Completed", "Active",
        termFrom(activity_date), `${freshProg.name} fresh enrolment — ${state.description}`);

      // Members whose previous term expired this month
      const expiredOn = `${YEAR}-${pad(month)}-${pad(Math.min(28, 3 + Math.floor(r() * 20)))}`;
      const oldReg = addDays(addMonths(expiredOn, -12), -60);
      const renewProg = PROGRAMS[(si + month + 1) % PROGRAMS.length];

      if (expiredOn < TODAY) {
        const renewed = 8 + Math.floor(r() * 18);
        const newExpiry = addMonths(expiredOn, 12);
        push("renewed", renewProg, renewed, "Renewal", "Completed", "Active", {
          registration_date: oldReg,
          enrolment_date_auto: addDays(oldReg, 60),
          expiry_date: newExpiry,
          renewal_date: addMonths(newExpiry, -2),
          renewal_status: "Renewed",
          renewed_on: expiredOn > activity_date ? expiredOn : activity_date,
        }, `${renewProg.name} renewal completed — ${state.description}`);
      }

      const overdue = backlog ? 6 + Math.floor(r() * 10) : Math.floor(r() * 4);
      if (overdue > 0) {
        const lapsedOn = expiredOn < TODAY ? expiredOn : addDays(TODAY, -(3 + Math.floor(r() * 20)));
        const lapsedReg = addDays(addMonths(lapsedOn, -12), -60);
        const overProg = PROGRAMS[(si + month + 2) % PROGRAMS.length];
        push("overdue", overProg, overdue, "Renewal", "Pending Payment", "Due for Renewal",
          { ...termFrom(lapsedReg), renewal_status: "Overdue" },
          `${overProg.name} renewal overdue — sponsor yet to pay`);
      }

      // Last two months: renewals initiated for members expiring within the next 60 days
      if (month >= LAST_MONTH - 1) {
        const dueProg = PROGRAMS[(si + month) % PROGRAMS.length];
        const expiry = addDays(TODAY, 5 + Math.floor(r() * 55));
        const reg = addDays(addMonths(expiry, -12), -60);
        push("due", dueProg, 5 + Math.floor(r() * 15), "Renewal", "In Progress", "Due for Renewal",
          { ...termFrom(reg), renewal_status: "Due Soon" },
          `${dueProg.name} renewal notice sent to sponsor`);
      }
    }
  });

  for (let i = 0; i < rows.length; i += 100) {
    await EnrolmentReport.bulkCreate(rows.slice(i, i + 100), { logging: false });
  }
  console.log(`\nSeeded ${rows.length} GIFSHIP renewal rows for ${states.length} states (${YEAR}, Jan–${LAST_MONTH})`);
  console.log(`  fresh enrolments: ${totals.fresh}`);
  console.log(`  renewals completed: ${totals.renewed}`);
  console.log(`  renewals overdue: ${totals.overdue}`);
  console.log(`  renewals due ≤60 days: ${totals.due}`);
  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err);
  try { await sequelize.close(); } catch { /* ignore */ }
  process.exit(1);
});
