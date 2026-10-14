/**
 * Align headquarters departments/divisions and zone-state units
 * with the Dept-Div-Units register.
 * Run: node src/scripts/syncDeptDivUnits.js
 */
require("dotenv").config();
const sequelize = require("../config/database");
require("../models/index");
const Department = require("../models/Department");
const Unit = require("../models/Unit");

const HQ_DEPARTMENTS = [
  {
    department_code: "RRSD",
    name: "Risk & Regulatory Services Dept (RRSD)",
    divisions: [
      ["RRSD-ERC", "Enterprise Risk Coordination"],
      ["RRSD-RIA", "Risk Intelligence & Actuarial Services"],
      ["RRSD-RGC", "Regulatory Standards, Governance & Coordination"],
      ["RRSD-ISS", "Insurance Schemes Supervision"],
    ],
  },
  {
    department_code: "SPDT",
    name: "Strategic Purchasing Department (SPD)",
    divisions: [
      ["SPDT-CME", "Contract Management and Empanelment"],
      ["SPDT-POP", "Purchasing Operations & Performance Monitoring"],
      ["SPDT-HTA", "Health Technology Assessment"],
      ["SPDT-NTB", "New Technology and Benefit Design"],
    ],
  },
  {
    department_code: "SDU",
    name: "Special Duties Office (SDO)",
    divisions: [
      ["SDU-SVC", "SERVICOM"],
      ["SDU-STK", "Stock Verification"],
      ["SDU-SOC", "State Office Coordination"],
    ],
  },
  {
    department_code: "CMD",
    name: "Contribution Management",
    divisions: [
      ["CMD-CON", "Contribution"],
      ["CMD-DIS", "Disbursement"],
      ["CMD-REC", "Reconciliation"],
      ["CMD-ENF", "Enforcement"],
      ["CMD-PRB", "Provider/Beneficiary"],
      ["CMD-PAY", "Purchaser (Payor)"],
      ["CMD-SAN", "Sanctions"],
      ["CMD-CC", "Call Centre"],
      ["CMD-CMP", "Compliance"],
    ],
  },
  {
    department_code: "HRM",
    name: "Human Resources",
    divisions: [
      ["HRM-APD", "Appointment, Promotion & Discipline"],
      ["HRM-TSW", "Training & Staff Welfare"],
      ["HRM-GS", "General Services"],
    ],
  },
  {
    department_code: "FAD",
    name: "Finance and Administration",
    divisions: [
      ["FAD-RIA", "Revenue & Investment"],
      ["FAD-EXP", "Expenditure"],
      ["FAD-BUD", "Budget"],
      ["FAD-FFR", "Final & Fiscal Reporting"],
    ],
  },
  {
    department_code: "PRS",
    name: "Planning Research & Statistics",
    divisions: [
      ["PRS-PP", "Planning & Policy"],
      ["PRS-RS", "Research & Statistics"],
      ["PRS-ME", "Monitoring & Evaluation"],
    ],
  },
  {
    department_code: "PROC",
    name: "Procurement",
    divisions: [
      ["PROC-CAP", "Capital Procurement"],
      ["PROC-REC", "Recurrent Procurement"],
    ],
  },
  {
    department_code: "IAD",
    name: "Internal Audit",
    divisions: [
      ["IAD-PPA", "Pre-payment System Audit"],
      ["IAD-FIN", "Financial Audit"],
      ["IAD-SYS", "System Audit"],
    ],
  },
  {
    department_code: "ICT",
    name: "ICT",
    divisions: [
      ["ICT-DB", "Database"],
      ["ICT-SYS", "System Administration"],
      ["ICT-NET", "Network Security & Communication"],
      ["ICT-CMC", "Call Management Centre"],
    ],
  },
  {
    department_code: "FSD",
    name: "Formal Sector",
    divisions: [
      ["FSD-PS", "Public Sector"],
      ["FSD-OPS", "Organized Private Sector"],
      ["FSD-GIF", "GIFSHIP"],
      ["FSD-TIS", "TISHIP"],
      ["FSD-ENR", "Enrolment"],
    ],
  },
  {
    department_code: "SQA",
    name: "SQA",
    divisions: [
      ["SQA-ACC", "Accreditation"],
      ["SQA-INS", "Inspectorate"],
      ["SQA-HMO", "HMO & Allied Services"],
    ],
  },
  {
    department_code: "LEG",
    name: "Legal",
    divisions: [
      ["LEG-LIT", "Litigation/Arbitration"],
      ["LEG-COR", "Corporate & Secretarial Services"],
    ],
  },
  {
    department_code: "MPR",
    name: "Media & Public Relations",
    divisions: [
      ["MPR-PRESS", "Press"],
      ["MPR-MKT", "Marketing"],
      ["MPR-PRO", "Protocol"],
    ],
  },
  {
    department_code: "ISD",
    name: "Informal Sector Department",
    divisions: [
      ["ISD-VG", "Vulnerable Group"],
      ["ISD-SPP", "Social Protection Program (SPP)"],
      ["ISD-IWC", "Informal Workers & Contribution (IW&C)"],
    ],
  },
];

const STATE_UNITS = [
  ["ZSU-PRG", "Programs"],
  ["ZSU-SQE", "SQA/Enforcement"],
  ["ZSU-HRA", "HR/Admin"],
  ["ZSU-ICT", "ICT"],
];

async function ensureColumns() {
  const qi = sequelize.getQueryInterface();
  const deptCols = await qi.describeTable("departments");
  if (!deptCols.location_scope) {
    await qi.addColumn("departments", "location_scope", { type: "VARCHAR(10)", allowNull: true });
  }
  const unitCols = await qi.describeTable("units");
  if (!unitCols.location_role) {
    await qi.addColumn("units", "location_role", { type: "VARCHAR(12)", allowNull: true });
  }
}

async function isReferenced(unitId) {
  const tables = [
    "users",
    "stock_assets",
    "stock_verifications",
    "store_assets",
    "supply_verifications",
    "physical_asset_verifications",
  ];
  for (const table of tables) {
    const [rows] = await sequelize.query(
      `SELECT COUNT(*) AS n FROM \`${table}\` WHERE unit_id = :unitId`,
      { replacements: { unitId } }
    );
    if (Number(rows[0]?.n || 0) > 0) return true;
  }
  return false;
}

async function upsertUnit(unitCode, name, departmentId, locationRole) {
  const existing = await Unit.findOne({ where: { unit_code: unitCode } });
  if (existing) {
    await existing.update({ name, department_id: departmentId, location_role: locationRole });
    return existing;
  }
  return Unit.create({
    unit_code: unitCode,
    name,
    department_id: departmentId,
    location_role: locationRole,
  });
}

async function upsertDepartment(code, name, locationScope) {
  const existing = await Department.findOne({ where: { department_code: code } });
  if (existing) {
    await existing.update({ name, location_scope: locationScope });
    return existing;
  }
  return Department.create({
    department_code: code,
    name,
    location_scope: locationScope,
  });
}

(async () => {
  try {
    await sequelize.authenticate();
    await ensureColumns();

    for (const dept of HQ_DEPARTMENTS) {
      const record = await upsertDepartment(dept.department_code, dept.name, "hq");
      const keep = new Set(dept.divisions.map(([code]) => code));
      for (const [code, name] of dept.divisions) {
        await upsertUnit(code, name, record.id, "division");
      }
      const extras = await Unit.findAll({ where: { department_id: record.id } });
      for (const extra of extras) {
        if (keep.has(extra.unit_code)) continue;
        if (await isReferenced(extra.id)) {
          await extra.update({ location_role: null });
          console.log(`  kept referenced unit ${extra.unit_code}`);
          continue;
        }
        await extra.destroy();
        console.log(`  removed ${extra.unit_code}`);
      }
      console.log(`✔  ${dept.name}`);
    }

    const stateDept = await upsertDepartment("ZSU", "Zones / States", "state");
    const keepState = new Set(STATE_UNITS.map(([code]) => code));
    for (const [code, name] of STATE_UNITS) {
      await upsertUnit(code, name, stateDept.id, "state_unit");
    }
    const stateExtras = await Unit.findAll({ where: { department_id: stateDept.id } });
    for (const extra of stateExtras) {
      if (keepState.has(extra.unit_code)) continue;
      if (!(await isReferenced(extra.id))) await extra.destroy();
    }
    console.log("✔  Zones / States units");

    console.log("\nDepartment and division register updated.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
