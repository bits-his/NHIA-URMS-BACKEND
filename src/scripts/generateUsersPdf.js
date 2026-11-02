/**
 * Generate official NHIA Production User Credentials PDF Directory.
 * Uses jsPDF and jspdf-autotable.
 *
 * Usage:
 *   node src/scripts/generateUsersPdf.js
 */
require("dotenv").config();
const path = require("path");
const fs = require("fs");
let jsPDF;
let autoTable;
try {
  const jspdfModule = require("jspdf");
  jsPDF = jspdfModule.jsPDF || jspdfModule.default || jspdfModule;
  const autotableModule = require("jspdf-autotable");
  autoTable = autotableModule.default || autotableModule;
} catch (_e1) {
  try {
    const jspdfModule = require("../../../frontend/node_modules/jspdf");
    jsPDF = jspdfModule.jsPDF || jspdfModule.default || jspdfModule;
    const autotableModule = require("../../../frontend/node_modules/jspdf-autotable");
    autoTable = autotableModule.default || autotableModule;
  } catch (_e2) {
    throw new Error("jsPDF or jspdf-autotable is not installed. Please run 'npm install jspdf jspdf-autotable' in backend.");
  }
}

const ARTIFACTS_DIR = "/Users/admin/.gemini/antigravity/brain/f7ebd5d6-da8f-4ed1-a038-abe6b9140fc3";
const STORAGE_DIR = path.resolve(__dirname, "../../storage/credentials");

// Standard initial production credentials matching the canonical user table
const PRODUCTION_ACCOUNTS = [
  {
    sn: 1,
    staff_id: "ADMIN001",
    name: "System Administrator",
    role: "admin",
    dept: "ICT",
    scope: "National (HQ)",
    email: "admin@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 2,
    staff_id: "SDO-0001",
    name: "Special Duties Office (SDO)",
    role: "sdo",
    dept: "SDO",
    scope: "National (HQ)",
    email: "sdo-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 3,
    staff_id: "SVCSC-0001",
    name: "Head SERVICOM Division",
    role: "svc-state-coordinator",
    dept: "SERVICOM (SVC)",
    scope: "National (HQ)",
    email: "svcsc-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 4,
    staff_id: "SVCRO-0001",
    name: "SERVICOM Reporting Officer",
    role: "svc-reporting-officer",
    dept: "SERVICOM (SVC)",
    scope: "State Office (Kano / NW)",
    email: "svcro-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 5,
    staff_id: "STKSC-0001",
    name: "Head Stock Verification Division",
    role: "stk-state-coordinator",
    dept: "Stock Verification (STK)",
    scope: "National (HQ)",
    email: "stksc-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 6,
    staff_id: "STKRO-0001",
    name: "Stock Verification Reporting Officer",
    role: "stk-reporting-officer",
    dept: "Stock Verification (STK)",
    scope: "State Office (Kano / NW)",
    email: "stkro-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 7,
    staff_id: "SOCSC-0001",
    name: "Head State Office Coordination",
    role: "soc-state-coordinator",
    dept: "State Coordination (SOC)",
    scope: "National (HQ)",
    email: "socsc-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 8,
    staff_id: "SOCRO-0001",
    name: "State Office Coordination Reporting Officer",
    role: "soc-reporting-officer",
    dept: "State Coordination (SOC)",
    scope: "State Office (Kano / NW)",
    email: "socro-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 9,
    staff_id: "SPDSC-0001",
    name: "Head Special Projects Unit",
    role: "spd-state-coordinator",
    dept: "Special Projects (SPD)",
    scope: "National (HQ)",
    email: "spdsc-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 10,
    staff_id: "SPDRO-0001",
    name: "Special Project Reporting Officer",
    role: "spd-reporting-officer",
    dept: "Special Projects (SPD)",
    scope: "State Office (Kano / NW)",
    email: "spdro-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 11,
    staff_id: "SC-0001",
    name: "State Coordinator",
    role: "state-coordinator",
    dept: "State Office Leadership",
    scope: "State Office (Kano / NW)",
    email: "sc-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 12,
    staff_id: "SOCZC-0001",
    name: "SOC Zonal Coordinator",
    role: "soc-zonal-coordinator",
    dept: "State Coordination (SOC)",
    scope: "Zonal Office (North West)",
    email: "soczc-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 13,
    staff_id: "SORO-0001",
    name: "State Office Reporting Officer (KN)",
    role: "state-officer",
    dept: "State Operations (SOC)",
    scope: "State Office (Kano / NW)",
    email: "soro-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 14,
    staff_id: "ENFZC-0001",
    name: "Director Enforcement (ENF)",
    role: "enf-zonal-coordinator",
    dept: "Enforcement (ENF)",
    scope: "National Directorate",
    email: "enfzc-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 15,
    staff_id: "FINZC-0001",
    name: "Director Finance and Admin (F&A)",
    role: "fin-zonal-coordinator",
    dept: "Finance & Admin (FIN)",
    scope: "National Directorate",
    email: "finzc-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 16,
    staff_id: "FSDZC-0001",
    name: "Director Formal Sector (FSD)",
    role: "fsd-zonal-coordinator",
    dept: "Formal Sector (FSD)",
    scope: "National Directorate",
    email: "fsdzc-0001@nhia.gov.ng",
    password: "123456",
  },
  {
    sn: 17,
    staff_id: "DG-0001",
    name: "Director-General / CEO",
    role: "dg-ceo",
    dept: "Executive Office",
    scope: "National Leadership",
    email: "dg-0001@nhia.gov.ng",
    password: "123456",
  },
];

function generateUsersPdf(outputPath) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Header & Title Banner
  doc.setFillColor(16, 42, 67); // Navy Blue #102a43
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setFillColor(0, 122, 140); // Accent Teal #007a8c
  doc.rect(0, 28, pageWidth, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("NATIONAL HEALTH INSURANCE AUTHORITY (NHIA)", pageWidth / 2, 11, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("FEDERAL MINISTRY OF HEALTH • CORPORATE HEADQUARTERS, ABUJA", pageWidth / 2, 17, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PRODUCTION USER ACCOUNTS & INITIAL CREDENTIAL DIRECTORY", pageWidth / 2, 23, { align: "center" });

  // 2. Document Meta Bar
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("CLASSIFICATION: STRICTLY CONFIDENTIAL / RESTRICTED", 14, 35);
  doc.setFont("helvetica", "normal");
  doc.text(`EFFECTIVE DATE: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, pageWidth - 14, 35, { align: "right" });

  // 3. Build Table
  const tableData = PRODUCTION_ACCOUNTS.map((acc) => [
    acc.sn,
    acc.staff_id,
    acc.name,
    acc.role,
    acc.dept,
    acc.scope,
    acc.email,
    acc.password,
  ]);

  const autoTableFn = autoTable.default || autoTable;
  autoTableFn(doc, {
    startY: 38,
    head: [
      [
        "S/N",
        "Staff ID",
        "Officer / Role Title",
        "Role Key",
        "Department",
        "Scope / Jurisdiction",
        "Login Email / ID",
        "Initial Temporary Password",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [15, 61, 46], // NHIA Deep Forest Green #0f3d2e
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [15, 23, 42],
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [244, 248, 246],
    },
    tableWidth: "auto",
    columnStyles: {
      0: { halign: "center" },
      1: { fontStyle: "bold" },
      2: { fontStyle: "bold" },
      7: { fontStyle: "bold", textColor: [180, 40, 40] },
    },
    margin: { left: 14, right: 14 },
  });

  // 4. Security Instructions & Official Sign-off Box
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 6 : 160;

  if (finalY < pageHeight - 35) {
    // Info Box
    doc.setFillColor(240, 247, 251);
    doc.setDrawColor(214, 232, 244);
    doc.roundedRect(14, finalY, pageWidth - 28, 24, 2, 2, "FD");

    doc.setTextColor(16, 42, 67);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("CRITICAL SECURITY & PRODUCTION ONBOARDING POLICIES:", 18, finalY + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(
      "1. Mandatory First Login Change: All designated officers are required to change their temporary password immediately upon first logon.",
      18,
      finalY + 10
    );
    doc.text(
      "2. Role-Based Access: Accounts possess scoped operational boundaries (State, Zonal, or National HQ) with full database referential integrity.",
      18,
      finalY + 14
    );
    doc.text(
      "3. Confidentiality: Distribution of this document is restricted strictly to authorised ICT provisioning officers and system administrators.",
      18,
      finalY + 18
    );
  }

  // 5. Footer Page Number
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.text(
    `NHIA Unified Reporting & Management System (URMS) • Document Ref: NHIA-PROD-AUTH-2026-V1`,
    pageWidth / 2,
    pageHeight - 6,
    { align: "center" }
  );

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  // Ensure storage directories exist
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, pdfBuffer);

  return pdfBuffer;
}

if (require.main === module) {
  const dest1 = path.join(STORAGE_DIR, "NHIA_Production_User_Credentials.pdf");
  generateUsersPdf(dest1);

  if (fs.existsSync(ARTIFACTS_DIR)) {
    const dest2 = path.join(ARTIFACTS_DIR, "NHIA_Production_User_Credentials.pdf");
    generateUsersPdf(dest2);
    console.log(`✅ Production User Credentials PDF generated at:\n  1. ${dest1}\n  2. ${dest2}`);
  } else {
    console.log(`✅ Production User Credentials PDF generated at:\n  1. ${dest1}`);
  }
}

module.exports = { generateUsersPdf, PRODUCTION_ACCOUNTS };
