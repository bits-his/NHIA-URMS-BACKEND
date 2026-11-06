/**
 * Seed demo data for the State Office dashboards (stakeholder, beneficiary,
 * challenges & support, provider management). Idempotent — deletes prior
 * SEED-* rows first. Run: node src/scripts/seedDashboardDemo.js
 */
const sequelize = require("../config/database");

const GEO = [
  { zone: "NW", states: ["KAN", "JIG", "KAD", "SOK", "ZAM", "KAT"] },
  { zone: "NC", states: ["BEN", "FCT", "NAS", "PLA"] },
  { zone: "NE", states: ["BAU", "BOR", "GOM"] },
  { zone: "SW", states: ["LAG", "OYO", "OGU"] },
  { zone: "SS", states: ["RIV", "AKW", "DEL"] },
  { zone: "SE", states: ["ANA", "ENU", "IMO"] },
];
// Spread of activity volumes per state (Kano highest for SORO testing).
const VOLUME = { KAN: 9, JIG: 5, KAD: 7, SOK: 4, ZAM: 3, KAT: 4, BEN: 5, FCT: 4, NAS: 3, PLA: 3, BAU: 4, BOR: 3, GOM: 2, LAG: 6, OYO: 4, OGU: 3, RIV: 5, AKW: 3, DEL: 3, ANA: 3, ENU: 2, IMO: 2 };
const MONTHS = [5, 6, 7, 8, 9, 10, 11];
const YEAR = 2026;
const pick = (arr, i) => arr[i % arr.length];

const ENGAGEMENT_CATEGORIES = ["SSHIA Technical Support", "Stakeholder Forum/Meeting", "Capacity Building", "Program Promotion", "Mediation Meetings", "BHCPF Gateway (SOC) Meeting", "Program Implementation/Monitoring", "Workshops/Seminar/Summit"];
const STAKEHOLDER_GROUPS = ["SSHIA", "HMO representatives", "Provider facilities", "MDA representatives", "Community leaders", "State Government", "Media"];
const PROGRAMMES = ["FSSHIP", "BHCPF", "TISHIP", "OPS", "GIFSHIP-G", "CBSHIP"];
const OUTCOME_CATS = ["Technical capacity improved", "Institutional readiness", "Programme acceptance increased", "Implementation issues addressed", "Partnership strengthened", "Increased stakeholder commitment"];
const OUTCOME_SPECS = { "Technical capacity improved": "Staff trained on reporting", "Institutional readiness": "SSHIA onboarding readiness", "Programme acceptance increased": "Community acceptance of scheme", "Implementation issues addressed": "Enrolment bottleneck resolved", "Partnership strengthened": "MoU follow-up agreed", "Increased stakeholder commitment": "Stakeholder pledged support" };
const FOLLOWUP_STATUS = ["Pending", "In Progress", "Completed", "No longer Applicable"];
const ACTIVITY_STATUS = ["Completed", "Completed", "Completed", "In Progress", "Not Conducted", "Deferred"];
const REPORT_STATUS = ["submitted", "submitted", "approved", "awaiting_review", "endorsed", "draft"];

const REASONS = ["Provider service quality", "Access and service availability", "HMO authorisation concerns", "Relocation", "Cost of services", "Staff dissatisfaction"];
const PROVIDERS = ["Hygeia HMO", "Reliance HMO", "AXA Mansard Health", "AIICO Multishield Ltd.", "Avon Healthcare", "Total Health Trust", "Clearline HMO", "Lagos University Teaching Hospital", "Maitama General Hospital", "Aminu Kano Teaching Hospital"];
const MDAS = ["State Internal Revenue Service", "State Teaching Service Commission", "State Water Board", "Ministry of Agriculture", "State Civil Service Commission"];

const CH_CATS = [
  { key: "Financial_Funding", label: "Financial Funding" },
  { key: "Technology_ICT", label: "Technology ICT" },
  { key: "HR_Staffing", label: "HR Staffing" },
  { key: "Data_Reporting", label: "Data & Reporting" },
  { key: "Program_Implementation", label: "Program Implementation" },
  { key: "Operational_Logistics", label: "Operational Logistics" },
  { key: "ProviderMangement", label: "Provider Management" },
  { key: "Procurement", label: "Procurement" },
];
const CH_SPECS = { Financial_Funding: "Premium payment delay", Technology_ICT: "Network failure", HR_Staffing: "Insufficient staffing/Staff shortage", Data_Reporting: "Incomplete records", Program_Implementation: "Low enrolment", Operational_Logistics: "Poor logistics for activity", ProviderMangement: "Accreditation delay", Procurement: "Delayed procurement approvals" };
const SEVERITIES = ["Low", "Medium", "Medium", "High", "High", "Critical"];
const IMPACTS = ["Delayed activity", "Reduced enrolment", "Delayed reporting", "Reduced service quality", "Affected beneficiary services", "Financial risk"];
const CH_STATUSES = ["In-progress", "Under Review", "Action Initiated", "Escalated", "Resolved", "Closed"];
const DEPTS = ["ICT", "Finance & Account", "HRMD", "SQA", "Procurement", "FSD", "PRSD", "SDO"];
const SU_OWNERS = ["SDO", "Other NHIA Departments", "Zonal Office", "Management", "External Stakeholder"];
const SU_CATS = { "ICT and Infrastructure": "ICT support", "Funding and Procurement": "Additional funding", "Human Resources and Capacity Building": "Additional staff", "Programme Implementation, Monitoring and Coordination": "Monitoring and supervision support", "Stakeholder Engagement and Public Awareness": "Public awareness/IEC materials", "Policy, Legal and Regulatory": "HQ approval" };
const SU_STATUSES = ["Submitted", "Under Review", "Assigned", "In Progress", "Resolved", "Closed", "In Progress", "Resolved"];
const SU_PRIORITIES = ["Critical", "High", "High", "Medium", "Medium", "Low"];

const PM_FORMS = ["accreditation", "reaccreditation", "qa-inspections", "medical-audits"];

function geoList() {
  const out = [];
  for (const g of GEO) for (const s of g.states) out.push({ state: s, zone: g.zone });
  return out;
}

async function wipe() {
  for (const [table, col, like] of [
    ["stakeholder_outcomes", "report_reference_id", "SEED-%"],
    ["stakeholder_reports", "reference_id", "SEED-%"],
    ["beneficiary_management_reports", "reference_id", "SEED-%"],
    ["support_requests", "support_id", "SEED-%"],
    ["challenges", "challenge_id", "SEED-%"],
    ["provider_management_reports", "reference_id", "SEED-%"],
  ]) {
    await sequelize.query(`DELETE FROM ${table} WHERE ${col} LIKE ?`, { replacements: [like] });
  }
}

async function seedStakeholder() {
  const geos = geoList();
  let n = 0;
  for (const { state, zone } of geos) {
    const count = Math.min(6, Math.max(2, Math.round((VOLUME[state] || 3) * 0.7)));
    for (let i = 0; i < count; i++) {
      n++;
      const m = pick(MONTHS, n + i);
      const ref = `SEED-STK-${String(n).padStart(3, "0")}`;
      const fu = n % 3 === 0;
      await sequelize.query(`INSERT INTO stakeholder_reports
        (reference_id, activity_module, zonal_code, state_code, reporting_year, reporting_month, quarter,
         planned_activities, submission_date, submitted_by, status,
         engagement_code, activity_date, engagement_category, stakeholder_categories, stakeholder_names,
         specific_activity, engagement_purpose, programs_supported, supporting_evidence_types,
         follow_up_required, follow_up_priority, follow_up_status, follow_up_action, follow_up_responsible, follow_up_date,
         activity_status, remarks, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`, {
        replacements: [
          ref, "engagement-coordination", zone, state, YEAR, m, Math.ceil(m / 3),
          count + 2, `${YEAR}-${String(m).padStart(2, "0")}-28`, "State Office Reporting Officer", pick(REPORT_STATUS, n),
          `ENG-${String(n).padStart(3, "0")}`, `${YEAR}-${String(m).padStart(2, "0")}-12`, pick(ENGAGEMENT_CATEGORIES, n),
          `${pick(STAKEHOLDER_GROUPS, n)}|${pick(STAKEHOLDER_GROUPS, n + 3)}`,
          `${pick(STAKEHOLDER_GROUPS, n)}, ${pick(STAKEHOLDER_GROUPS, n + 3)}`,
          "Quarterly engagement session", "Programme coordination and uptake",
          `${pick(PROGRAMMES, n)}|${pick(PROGRAMMES, n + 2)}`,
          "Attendance register|Meeting minutes",
          fu ? "yes" : "no", fu ? pick(["High", "Medium", "Low"], n) : null,
          fu ? pick(FOLLOWUP_STATUS, n) : null,
          fu ? "Follow up on agreed action points" : null, fu ? "Desk Officer" : null,
          fu ? `${YEAR}-${String(Math.min(12, m + 1)).padStart(2, "0")}-10` : null,
          pick(ACTIVITY_STATUS, n), null,
        ],
      });
      const nOutcomes = 1 + (n % 2);
      for (let s = 1; s <= nOutcomes; s++) {
        const cat = pick(OUTCOME_CATS, n + s);
        await sequelize.query(
          "INSERT INTO stakeholder_outcomes (report_reference_id, sn, outcome_category, specific_outcome, created_at, updated_at) VALUES (?,?,?,?, NOW(), NOW())",
          { replacements: [ref, s, cat, OUTCOME_SPECS[cat]] },
        );
      }
    }
  }
  return n;
}

async function seedBeneficiary() {
  const geos = geoList();
  const TYPES = ["additional_dependant", "additional_dependant", "extra_dependant", "extra_dependant", "hcp_change", "hcp_change", "hmo_change", "mda_hmo_selection"];
  let n = 0;
  for (const { state, zone } of geos) {
    const count = Math.min(7, Math.max(2, Math.round((VOLUME[state] || 3) * 0.8)));
    for (let i = 0; i < count; i++) {
      n++;
      const m = pick(MONTHS, n * 2 + i);
      const type = pick(TYPES, n);
      const isChange = type === "hcp_change" || type === "hmo_change";
      const isMda = type === "mda_hmo_selection";
      await sequelize.query(`INSERT INTO beneficiary_management_reports
        (reference_id, activity_type, zonal_code, state_code, reporting_year, reporting_month, quarter,
         submission_date, submitted_by, status, endorsed,
         enrollee_name, nhia_number, program_name, mda, request_date, activity_status, remarks,
         change_entity_type, current_provider, new_provider, reason_category,
         former_hmo, selected_hmo, hmos_invited, hmos_attended, hmos_in_attendance, hmos_invited_names,
         compliance_guideline, transparent_process, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`, {
        replacements: [
          `SEED-BM-${String(n).padStart(3, "0")}`, type, zone, state, YEAR, m, Math.ceil(m / 3),
          `${YEAR}-${String(m).padStart(2, "0")}-25`, "State Office Reporting Officer", pick(["submitted", "approved", "submitted", "draft", "approved"], n), n % 3 !== 0,
          isMda ? null : `Enrollee ${n}`, isMda ? null : `NHIA-${1000 + n}`, pick(PROGRAMMES, n), isMda ? pick(MDAS, n) : null,
          `${YEAR}-${String(m).padStart(2, "0")}-08`, pick(["Completed", "In Progress", "Completed", "Pending", "Completed"], n), null,
          isChange ? (type === "hcp_change" ? "hcp" : "hmo") : null,
          isChange ? pick(PROVIDERS, n) : null, isChange ? pick(PROVIDERS, n + 4) : null,
          isChange ? pick(REASONS, n) : null,
          isMda ? pick(PROVIDERS, n) : null, isMda ? pick(PROVIDERS, n + 3) : null,
          isMda ? 4 + (n % 3) : null, isMda ? 3 + (n % 2) : null,
          isMda ? `${pick(PROVIDERS, n)}, ${pick(PROVIDERS, n + 1)}, ${pick(PROVIDERS, n + 2)}` : null,
          isMda ? `${pick(PROVIDERS, n)}, ${pick(PROVIDERS, n + 1)}, ${pick(PROVIDERS, n + 2)}, ${pick(PROVIDERS, n + 4)}` : null,
          isMda ? pick(["yes", "yes", "no"], n) : null, isMda ? pick(["yes", "yes", "no"], n) : null,
        ],
      });
    }
  }
  return n;
}

async function seedChallenges() {
  const geos = geoList();
  let cn = 0; let sn = 0;
  for (const { state, zone } of geos) {
    const count = Math.min(4, Math.max(1, Math.round((VOLUME[state] || 3) * 0.5)));
    for (let i = 0; i < count; i++) {
      cn++;
      const cat = pick(CH_CATS, cn);
      const sev = pick(SEVERITIES, cn);
      const status = pick(CH_STATUSES, cn);
      const m = pick(MONTHS, cn + i);
      const chId = `SEED-CH-${String(cn).padStart(3, "0")}`;
      await sequelize.query(`INSERT INTO challenges
        (challenge_id, state_code, zonal_code, date_reported, related_activity, programme,
         category_key, category_label, specific_challenge, severity, impact, status,
         escalation_department, description, created_by_name, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`, {
        replacements: [
          chId, state, zone, `${YEAR}-${String(m).padStart(2, "0")}-${String(3 + (cn % 25)).padStart(2, "0")}`,
          pick(["Enrolment Drives", "Stakeholder Engagement", "Provider Management", "Internal Operations"], cn),
          pick(PROGRAMMES, cn), cat.key, cat.label, CH_SPECS[cat.key], sev, pick(IMPACTS, cn), status,
          pick(DEPTS, cn), `${CH_SPECS[cat.key]} affecting ${pick(PROGRAMMES, cn)} activities in the state.`, "State Office Reporting Officer",
        ],
      });
      // 1–2 linked support requests per challenge (skip some → standalone later).
      const nSup = cn % 3 === 0 ? 0 : 1 + (cn % 2);
      for (let k = 0; k < nSup; k++) {
        sn++;
        const suCat = pick(Object.keys(SU_CATS), sn);
        const suStatus = pick(SU_STATUSES, sn);
        const m2 = Math.min(12, m + (sn % 2));
        const reqBy = `${YEAR}-${String(Math.min(12, m2 + 1)).padStart(2, "0")}-${String(5 + (sn % 20)).padStart(2, "0")}`;
        const supId = `SEED-SUP-${String(sn).padStart(3, "0")}`;
        await sequelize.query(`INSERT INTO support_requests
          (support_id, state_code, zonal_code, challenge_id, date_submitted, action_required_from,
           nhia_department, support_category, specific_support, priority, description,
           required_by_date, status, submitted_by_name, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`, {
          replacements: [
            supId, state, zone, chId, `${YEAR}-${String(m2).padStart(2, "0")}-15`,
            pick(SU_OWNERS, sn), pick(DEPTS, sn), suCat, SU_CATS[suCat], pick(SU_PRIORITIES, sn),
            `Support required: ${SU_CATS[suCat]} for ${CH_SPECS[cat.key]}.`,
            reqBy, suStatus, "State Office Reporting Officer",
          ],
        });
        if (suStatus === "Resolved" || suStatus === "Closed") {
          await sequelize.query(`INSERT INTO challenge_support_history
            (history_id, support_id, action, to_status, actor_name, created_at, updated_at)
            VALUES (?,?,?,?,?, ?, ?)`, {
            replacements: [`SEED-H-${supId}`, supId, "status", "Resolved", "SDO Officer",
              `${YEAR}-${String(Math.min(12, m2 + 1)).padStart(2, "0")}-20 10:00:00`,
              `${YEAR}-${String(Math.min(12, m2 + 1)).padStart(2, "0")}-20 10:00:00`],
          });
        }
      }
    }
  }
  // A few standalone requests (no linked challenge).
  for (let k = 0; k < 8; k++) {
    sn++;
    const { state, zone } = geos[(k * 3) % geos.length];
    const suCat = pick(Object.keys(SU_CATS), sn);
    await sequelize.query(`INSERT INTO support_requests
      (support_id, state_code, zonal_code, challenge_id, date_submitted, action_required_from,
       nhia_department, support_category, specific_support, priority, description,
       required_by_date, status, submitted_by_name, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`, {
      replacements: [
        `SEED-SUP-${String(sn).padStart(3, "0")}`, state, zone, null,
        `${YEAR}-${String(pick(MONTHS, sn)).padStart(2, "0")}-18`,
        pick(SU_OWNERS, sn), pick(DEPTS, sn), suCat, SU_CATS[suCat], pick(SU_PRIORITIES, sn),
        `Standalone request: ${SU_CATS[suCat]}.`,
        `${YEAR}-12-${String(5 + (sn % 20)).padStart(2, "0")}`, pick(SU_STATUSES, sn), "State Office Reporting Officer",
      ],
    });
  }
  return { challenges: cn, support: sn };
}

async function seedProvider() {
  const geos = geoList();
  let n = 0;
  for (const { state, zone } of geos) {
    const count = Math.min(5, Math.max(2, Math.round((VOLUME[state] || 3) * 0.6)));
    for (let i = 0; i < count; i++) {
      n++;
      const m = pick(MONTHS, n + i * 2);
      const form = pick(PM_FORMS, n);
      const prog = pick(["FSSHIP", "FSSHIP", "BHCPF", "TISHIP", "OPS"], n);
      const planned = 20 + ((n * 7) % 40);
      const covered = Math.max(0, planned - ((n * 5) % 15));
      await sequelize.query(`INSERT INTO provider_management_reports
        (reference_id, form_type, zonal_code, state_code, reporting_year, reporting_month, quarter,
         submission_date, submitted_by, status,
         related_programme, activity_date, total_facilities_in_state, facilities_planned, facilities_covered,
         awaiting_accreditation, awaiting_reaccreditation, phcs_awaiting_accreditation, phcs_awaiting_reaccreditation,
         applications_received, activity_status, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`, {
        replacements: [
          `SEED-PM-${String(n).padStart(3, "0")}`, form, zone, state, YEAR, m, Math.ceil(m / 3),
          `${YEAR}-${String(m).padStart(2, "0")}-27`, "State Office Reporting Officer", pick(REPORT_STATUS, n),
          prog, `${YEAR}-${String(m).padStart(2, "0")}-14`, 120 + ((n * 11) % 60), planned, covered,
          form === "accreditation" ? 8 + (n % 10) : null,
          form === "reaccreditation" ? 6 + (n % 8) : null,
          prog === "BHCPF" && form === "accreditation" ? 5 + (n % 6) : null,
          prog === "BHCPF" && form === "reaccreditation" ? 4 + (n % 5) : null,
          form === "accreditation" || form === "reaccreditation" ? 10 + (n % 12) : null,
          pick(ACTIVITY_STATUS, n),
        ],
      });
    }
  }
  return n;
}

(async () => {
  await wipe();
  const stk = await seedStakeholder();
  const bm = await seedBeneficiary();
  const cs = await seedChallenges();
  const pm = await seedProvider();
  console.log(`Seeded: ${stk} stakeholder, ${bm} beneficiary, ${cs.challenges} challenges + ${cs.support} support requests, ${pm} provider management`);
  await sequelize.close();
})().catch(async (e) => { console.error(e.message); await sequelize.close(); process.exit(1); });
