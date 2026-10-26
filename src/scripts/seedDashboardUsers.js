/**
 * Users for the three unit dashboards.
 *
 *   SVC-0001   SERVICOM staff          → SERVICOM dashboard (national)
 *   SVU-0001   SVU staff               → Stock verification dashboard (national)
 *   ENF-SO-001 State enforcement       → Complaint register, locked to one state
 *
 * Password for all three: Nhia@2025
 *
 *   node src/scripts/seedDashboardUsers.js
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
require("../models/index");
const { User } = require("../models/User");
const Department = require("../models/Department");
const StateOffice = require("../models/StateOffice");
const PrepaymentAnalysis = require("../models/PrepaymentAnalysis");

const PASSWORD = "Nhia@2025";

const notifications = [{ access_to: "Notifications", functionalities: ["Notifications"] }];

const servicomAccess = [
  {
    access_to: "SDO",
    functionalities: [
      "SERVICOM Dashboard",
      "Charter Performance",
      "HCF Customer Satisfaction Survey",
      "Complaints Management",
    ],
  },
  ...notifications,
];

const svuAccess = [
  {
    access_to: "SDO",
    functionalities: [
      "Stock Verification Dashboard",
      "Physical Asset Verification",
      "Stock Prepayment Register",
    ],
  },
  ...notifications,
];

const stateComplaintAccess = [
  {
    access_to: "SDO",
    functionalities: ["Complaints Management"],
  },
  {
    access_to: "Zonal",
    functionalities: ["State Complaints Register"],
  },
  ...notifications,
];

async function upsert(spec) {
  const hashed = await bcrypt.hash(PASSWORD, 12);
  const payload = {
    name: spec.name,
    email: spec.email,
    password: hashed,
    role: spec.role,
    zone_id: spec.zone_id ?? null,
    state_id: spec.state_id ?? null,
    department_id: spec.department_id ?? null,
    is_active: true,
    functionalities: spec.functionalities,
  };
  const existing = await User.findOne({ where: { staff_id: spec.staff_id } });
  if (existing) {
    await existing.update(payload);
    return "updated";
  }
  await User.create({ staff_id: spec.staff_id, ...payload });
  return "created";
}

(async () => {
  try {
    await sequelize.authenticate();
    await PrepaymentAnalysis.ensurePrepaymentColumns().catch(() => {});

    const [svcDept, stkDept, enfDept] = await Promise.all([
      Department.findOne({ where: { department_code: "SVC" } }),
      Department.findOne({ where: { department_code: "STK" } }),
      Department.findOne({ where: { department_code: "ENF" } }),
    ]);

    const state = await StateOffice.findOne({
      where: { description: { [Op.like]: "%Lagos%" } },
    }) || await StateOffice.findOne({ order: [["id", "ASC"]] });

    const specs = [
      {
        staff_id: "SVC-0001",
        name: "SERVICOM Staff",
        email: "svc-0001@nhia.gov.ng",
        role: "hq-department",
        department_id: svcDept?.id ?? null,
        functionalities: servicomAccess,
      },
      {
        staff_id: "SVU-0001",
        name: "SVU Staff",
        email: "svu-0001@nhia.gov.ng",
        role: "hq-department",
        department_id: stkDept?.id ?? null,
        functionalities: svuAccess,
      },
      {
        staff_id: "ENF-SO-001",
        name: state ? `${state.description} Enforcement Officer` : "State Enforcement Officer",
        email: "enf-so-001@nhia.gov.ng",
        role: "state-officer",
        zone_id: state?.zonal_id ?? null,
        state_id: state?.id ?? null,
        department_id: enfDept?.id ?? null,
        functionalities: stateComplaintAccess,
      },
    ];

    for (const spec of specs) {
      const action = await upsert(spec);
      console.log(`${action === "created" ? "Created" : "Updated"} ${spec.staff_id} — ${spec.name}`);
    }

    console.log(`
Dashboard users (password ${PASSWORD})
  SVC-0001     SERVICOM dashboard, comment cards, surveys, complaints
  SVU-0001     Stock dashboard, asset verification, prepayment
  ENF-SO-001   Complaint dashboard, locked to ${state?.description || "their state"}
`);
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
