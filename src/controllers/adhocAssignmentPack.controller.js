const { Op } = require("sequelize");
const sequelize = require("../config/database");
const AdhocMasterAssignment = require("../models/adhoc/AdhocMasterAssignment");
const AdhocStateAssignment = require("../models/adhoc/AdhocStateAssignment");
const AdhocStateReport = require("../models/adhoc/AdhocStateReport");
const StateOffice = require("../models/StateOffice");
const ZonalOffice = require("../models/ZonalOffice");
const Department = require("../models/Department");
const { User } = require("../models/User");
const AppNotification = require("../models/AppNotification");

/** Generate next Master Assignment ID: ASG-YYYY-#### */
async function generateMasterId(year = new Date().getFullYear()) {
  const prefix = `ASG-${year}-`;
  const existing = await AdhocMasterAssignment.findAll({
    where: { master_assignment_id: { [Op.like]: `${prefix}%` } },
    attributes: ["master_assignment_id"],
  });
  let maxSeq = 0;
  for (const row of existing) {
    const numPart = row.master_assignment_id.replace(prefix, "");
    const seq = parseInt(numPart, 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }
  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

/** Check if user has SDO or Admin privileges */
function isSdoOrAdmin(user) {
  if (!user) return false;
  const role = String(user.role || "").toLowerCase();
  if (role === "admin" || role === "sdo" || role.startsWith("sdo-")) return true;
  if (user.department_code === "SDU" || user.department_code === "SDO" || user.department_code === "SPD") return true;
  return false;
}

/** 1. Create SDO Master Assignment (Form 1) */
async function createMasterAssignment(req, res, next) {
  try {
    const {
      assignment_title,
      originating_department_code,
      originating_department_other,
      date_received,
      priority = "normal",
      reference_memo_number,
      received_through = "official_memo",
      received_through_other,
      date_on_instruction,
      assignment_due_date,
      assignment_description,
      expected_output,
      reporting_requirement = "final",
      additional_instructions,
      custom_master_id,
    } = req.body;

    if (!assignment_title || !assignment_title.trim()) {
      return res.status(422).json({ success: false, message: "Assignment title is required" });
    }
    if (!originating_department_code) {
      return res.status(422).json({ success: false, message: "Originating department is required" });
    }
    if (!date_received) {
      return res.status(422).json({ success: false, message: "Date received is required" });
    }
    if (!assignment_due_date) {
      return res.status(422).json({ success: false, message: "Assignment due date is required" });
    }
    if (!assignment_description || !assignment_description.trim()) {
      return res.status(422).json({ success: false, message: "Assignment description is required" });
    }
    if (!expected_output || !expected_output.trim()) {
      return res.status(422).json({ success: false, message: "Expected output is required" });
    }

    const year = date_received ? new Date(date_received).getFullYear() : new Date().getFullYear();
    const master_assignment_id = (custom_master_id && custom_master_id.trim())
      ? custom_master_id.trim()
      : await generateMasterId(year);

    let original_instruction_url = req.body.original_instruction_url || null;
    let original_instruction_name = req.body.original_instruction_name || null;
    if (req.file) {
      original_instruction_url = `/uploads/adhoc/${req.file.filename}`;
      original_instruction_name = req.file.originalname;
    }

    const sdo_officer_id = req.user?.id || null;
    const sdo_officer_name = req.user?.name || req.user?.staff_id || "SDO Officer";

    const record = await AdhocMasterAssignment.create({
      master_assignment_id,
      assignment_title: assignment_title.trim(),
      originating_department_code,
      originating_department_other: originating_department_code === "OTHER" ? originating_department_other : null,
      date_received,
      priority,
      reference_memo_number: reference_memo_number ? reference_memo_number.trim() : null,
      received_through,
      received_through_other: received_through === "other" ? received_through_other : null,
      date_on_instruction: date_on_instruction || null,
      sdo_officer_id,
      sdo_officer_name,
      assignment_due_date,
      assignment_description: assignment_description.trim(),
      expected_output: expected_output.trim(),
      original_instruction_url,
      original_instruction_name,
      reporting_requirement,
      additional_instructions: additional_instructions ? additional_instructions.trim() : null,
      status: "draft",
      created_by_user_id: req.user?.id || null,
    });

    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

/** 2. Update SDO Master Assignment */
async function updateMasterAssignment(req, res, next) {
  try {
    const { id } = req.params;
    const record = await AdhocMasterAssignment.findByPk(id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Master assignment not found" });
    }

    // Guard: Once assigned to states and any state report is submitted, master assignment cannot be edited
    const submittedReportsCount = await AdhocStateReport.count({
      include: [
        {
          model: AdhocStateAssignment,
          as: "state_assignment",
          where: { master_assignment_id: id },
          required: true,
        },
      ],
      where: {
        review_status: { [Op.ne]: "draft" },
      },
    });

    if (submittedReportsCount > 0) {
      return res.status(400).json({
        success: false,
        message: "This assignment cannot be edited because one or more State Offices have already submitted reports.",
      });
    }

    let original_instruction_url = record.original_instruction_url;
    let original_instruction_name = record.original_instruction_name;
    if (req.file) {
      original_instruction_url = `/uploads/adhoc/${req.file.filename}`;
      original_instruction_name = req.file.originalname;
    }

    const {
      assignment_title,
      originating_department_code,
      originating_department_other,
      date_received,
      priority,
      reference_memo_number,
      received_through,
      received_through_other,
      date_on_instruction,
      assignment_due_date,
      assignment_description,
      expected_output,
      reporting_requirement,
      additional_instructions,
      status,
    } = req.body;

    await record.update({
      assignment_title: assignment_title ?? record.assignment_title,
      originating_department_code: originating_department_code ?? record.originating_department_code,
      originating_department_other: originating_department_other ?? record.originating_department_other,
      date_received: date_received ?? record.date_received,
      priority: priority ?? record.priority,
      reference_memo_number: reference_memo_number ?? record.reference_memo_number,
      received_through: received_through ?? record.received_through,
      received_through_other: received_through_other ?? record.received_through_other,
      date_on_instruction: date_on_instruction ?? record.date_on_instruction,
      assignment_due_date: assignment_due_date ?? record.assignment_due_date,
      assignment_description: assignment_description ?? record.assignment_description,
      expected_output: expected_output ?? record.expected_output,
      original_instruction_url,
      original_instruction_name,
      reporting_requirement: reporting_requirement ?? record.reporting_requirement,
      additional_instructions: additional_instructions ?? record.additional_instructions,
      status: status ?? record.status,
    });

    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

/** 3. List Master Assignments with summary statistics */
async function listMasterAssignments(req, res, next) {
  try {
    const { status, year, department, search } = req.query;
    const where = {};

    if (status) where.status = status;
    if (department) where.originating_department_code = department;

    // Scoping: Originating department only sees directives it originated
    if (!isSdoOrAdmin(req.user) && req.user?.department_code && !req.user?.state_code && !req.user?.zonal_code) {
      where.originating_department_code = req.user.department_code;
    }
    if (year) {
      where.date_received = {
        [Op.between]: [`${year}-01-01`, `${year}-12-31`],
      };
    }
    if (search) {
      where[Op.or] = [
        { master_assignment_id: { [Op.like]: `%${search}%` } },
        { assignment_title: { [Op.like]: `%${search}%` } },
        { reference_memo_number: { [Op.like]: `%${search}%` } },
      ];
    }

    const masters = await AdhocMasterAssignment.findAll({
      where,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: AdhocStateAssignment,
          as: "state_assignments",
          include: [
            { model: StateOffice, as: "state", attributes: ["code", "description"] },
            { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
            { model: AdhocStateReport, as: "reports", attributes: ["id", "completion_status", "review_status", "date_completed"] },
          ],
        },
      ],
    });

    const formatted = masters.map((m) => {
      const states = m.state_assignments || [];
      const totalStates = states.length;
      let completedStates = 0;
      let inProgressStates = 0;
      let notStartedStates = 0;
      let submittedReportsCount = 0;

      for (const sa of states) {
        if (sa.progress_status === "completed") completedStates++;
        else if (sa.progress_status === "in_progress") inProgressStates++;
        else notStartedStates++;

        if (Array.isArray(sa.reports) && sa.reports.some((r) => r.review_status && r.review_status !== "draft")) {
          submittedReportsCount++;
        }
      }

      return {
        ...m.toJSON(),
        stats: {
          totalStates,
          completedStates,
          inProgressStates,
          notStartedStates,
          submittedReportsCount,
          hasSubmittedReports: submittedReportsCount > 0 || completedStates > 0,
        },
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
}

/** 4. Get single Master Assignment with all State Assignments and Reports */
async function getMasterAssignment(req, res, next) {
  try {
    const { id } = req.params;
    const master = await AdhocMasterAssignment.findByPk(id, {
      include: [
        {
          model: AdhocStateAssignment,
          as: "state_assignments",
          include: [
            { model: StateOffice, as: "state", attributes: ["code", "description"] },
            { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
            {
              model: AdhocStateReport,
              as: "reports",
              order: [["created_at", "DESC"]],
            },
          ],
        },
      ],
    });

    if (!master) {
      return res.status(404).json({ success: false, message: "Master assignment not found" });
    }

    res.json({ success: true, data: master });
  } catch (err) {
    next(err);
  }
}

/** 5. Dispatch Master Assignment to States (Form 2) */
async function dispatchToStates(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const master = await AdhocMasterAssignment.findByPk(id, { transaction: t });
    if (!master) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Master assignment not found" });
    }

    const {
      states = [],
      distribution_date = new Date().toISOString().slice(0, 10),
      dispatch_message = "",
      copy_zonal_coordinator = true,
      default_due_date,
    } = req.body;

    if (!Array.isArray(states) || states.length === 0) {
      await t.rollback();
      return res.status(422).json({ success: false, message: "Select at least one State to dispatch" });
    }

    const fallbackDueDate = default_due_date || master.assignment_due_date;
    const stateCodes = states.map((s) => (typeof s === "string" ? s : s.state_code));

    const stateOffices = await StateOffice.findAll({
      where: { code: stateCodes },
      transaction: t,
    });
    const stateMap = new Map(stateOffices.map((so) => [so.code, so]));

    const createdRecords = [];

    for (const item of states) {
      const code = typeof item === "string" ? item : item.state_code;
      const so = stateMap.get(code);
      if (!so) continue;

      const dueDate = (typeof item === "object" && item.state_due_date) ? item.state_due_date : fallbackDueDate;
      const state_assignment_id = `${master.master_assignment_id}-${so.code}`;

      const [record, created] = await AdhocStateAssignment.findOrCreate({
        where: { state_assignment_id },
        defaults: {
          state_assignment_id,
          master_assignment_id: master.master_assignment_id,
          state_code: so.code,
          zonal_code: so.zonal_code,
          state_due_date: dueDate,
          dispatch_date: distribution_date,
          dispatch_message: dispatch_message || null,
          copy_zonal_coordinator: !!copy_zonal_coordinator,
          progress_status: "not_started",
          closure_status: "open",
        },
        transaction: t,
      });

      if (!created) {
        await record.update({
          state_due_date: dueDate,
          dispatch_date: distribution_date,
          dispatch_message: dispatch_message || record.dispatch_message,
        }, { transaction: t });
      }

      createdRecords.push(record);
    }

    await master.update({ status: "dispatched" }, { transaction: t });
    await t.commit();

    // Trigger in-app notifications in background
    (async () => {
      try {
        for (const sa of createdRecords) {
          const stateUsers = await User.findAll({
            where: { state_code: sa.state_code, is_active: true },
            attributes: ["id"],
          });
          for (const u of stateUsers) {
            await AppNotification.create({
              user_id: u.id,
              title: `New Special Assignment: ${master.assignment_title}`,
              body: `Assignment ${sa.state_assignment_id} has been issued to your state. Due: ${sa.state_due_date}.`,
              type: "task",
              link: `/sdo/projects/${sa.state_assignment_id}`,
              entity_type: "adhoc_assignment",
            }).catch(() => {});
          }
        }
      } catch (_) {}
    })();

    res.json({
      success: true,
      message: `Dispatched to ${createdRecords.length} state(s) successfully`,
      data: createdRecords,
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
}

/** 6. List State Assignments (Scoped by Role) */
async function listStateAssignments(req, res, next) {
  try {
    const user = req.user;
    const { status, search, year } = req.query;
    const where = {};

    // Scoping
    if (!isSdoOrAdmin(user)) {
      if (user?.state_code) {
        where.state_code = user.state_code;
      } else if (user?.zonal_code) {
        where.zonal_code = user.zonal_code;
      } else if (user?.department_code) {
        // Originating department officer
        // Filter via master include
      }
    }

    if (status) where.progress_status = status;

    const masterWhere = {};
    if (year) {
      masterWhere.date_received = {
        [Op.between]: [`${year}-01-01`, `${year}-12-31`],
      };
    }
    if (user?.department_code && !isSdoOrAdmin(user) && !user?.state_code && !user?.zonal_code) {
      masterWhere.originating_department_code = user.department_code;
    }
    if (search) {
      where[Op.or] = [
        { state_assignment_id: { [Op.like]: `%${search}%` } },
        { master_assignment_id: { [Op.like]: `%${search}%` } },
      ];
    }

    const assignments = await AdhocStateAssignment.findAll({
      where,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: AdhocMasterAssignment,
          as: "master_assignment",
          where: Object.keys(masterWhere).length > 0 ? masterWhere : undefined,
        },
        { model: StateOffice, as: "state", attributes: ["code", "description"] },
        { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
        {
          model: AdhocStateReport,
          as: "reports",
          order: [["created_at", "DESC"]],
        },
      ],
    });

    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
}

/** 7. Get single State Assignment Details */
async function getStateAssignment(req, res, next) {
  try {
    const { stateAssignmentId } = req.params;
    const assignment = await AdhocStateAssignment.findByPk(stateAssignmentId, {
      include: [
        { model: AdhocMasterAssignment, as: "master_assignment" },
        { model: StateOffice, as: "state", attributes: ["code", "description"] },
        { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
        {
          model: AdhocStateReport,
          as: "reports",
          order: [["created_at", "DESC"]],
        },
      ],
    });

    if (!assignment) {
      return res.status(404).json({ success: false, message: "State assignment not found" });
    }

    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
}

/** 8. Submit State Report (Form 2) */
async function submitStateReport(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const { stateAssignmentId } = req.params;
    const assignment = await AdhocStateAssignment.findByPk(stateAssignmentId, {
      include: [{ model: AdhocMasterAssignment, as: "master_assignment" }],
      transaction: t,
    });

    if (!assignment) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "State assignment not found" });
    }

    // Role Guard: State officers can only submit reports for their assigned State Office
    if (!isSdoOrAdmin(req.user) && req.user?.state_code && assignment.state_code !== req.user.state_code) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: `Access denied: You can only submit reports for your assigned state (${req.user.state_code}).`,
      });
    }

    const {
      completion_status,
      date_completed,
      work_summary,
      output_achieved,
      challenges,
      is_draft,
    } = req.body;

    const isDraft = is_draft === "true" || is_draft === true;

    if (!isDraft) {
      if (!completion_status) {
        await t.rollback();
        return res.status(422).json({ success: false, message: "Completion status is required" });
      }
      if (!work_summary || !work_summary.trim()) {
        await t.rollback();
        return res.status(422).json({ success: false, message: "Summary of work carried out is required" });
      }
      if (!output_achieved || !output_achieved.trim()) {
        await t.rollback();
        return res.status(422).json({ success: false, message: "Output / outcome achieved is required" });
      }
    }

    // Process files
    let evidence_files = [];
    if (req.body.evidence_files) {
      try {
        evidence_files = typeof req.body.evidence_files === "string"
          ? JSON.parse(req.body.evidence_files)
          : req.body.evidence_files;
      } catch (_) {}
    }
    if (req.files && Array.isArray(req.files)) {
      for (const f of req.files) {
        evidence_files.push({
          name: f.originalname,
          path: `/uploads/adhoc/${f.filename}`,
          mime: f.mimetype,
          size: f.size,
          uploaded_at: new Date().toISOString(),
        });
      }
    }

    // Count previous reports for versioning
    const existingCount = await AdhocStateReport.count({
      where: { state_assignment_id: stateAssignmentId },
      transaction: t,
    });

    const report = await AdhocStateReport.create({
      state_assignment_id: stateAssignmentId,
      report_version: existingCount + 1,
      completion_status: completion_status || "ongoing",
      date_completed: (completion_status === "completed" && date_completed) ? date_completed : null,
      work_summary: (work_summary || "").trim(),
      output_achieved: (output_achieved || "").trim(),
      challenges: challenges ? challenges.trim() : null,
      evidence_files,
      review_status: isDraft ? "draft" : "submitted",
      submitted_by: req.user?.id || null,
      submitted_by_name: req.user?.name || req.user?.staff_id || "State Officer",
      submitted_at: new Date(),
    }, { transaction: t });

    // Update state assignment progress
    const nextProgress = isDraft
      ? "in_progress"
      : completion_status === "completed"
        ? "completed"
        : "in_progress";

    await assignment.update({ progress_status: nextProgress }, { transaction: t });
    await t.commit();

    // In-app notifications to SDO and originating department in background (only on real submission)
    if (!isDraft) {
      (async () => {
        try {
          const sdoUsers = await User.findAll({
            where: { role: ["sdo", "admin"], is_active: true },
            attributes: ["id"],
          });
          const masterTitle = assignment.master_assignment?.assignment_title || "Special Assignment";
          for (const u of sdoUsers) {
            await AppNotification.create({
              user_id: u.id,
              title: `Report Submitted: ${assignment.state_assignment_id}`,
              body: `State ${assignment.state_code} submitted report for "${masterTitle}".`,
              type: "report",
              link: `/sdo/projects/master/${assignment.master_assignment_id}`,
              entity_type: "adhoc_report",
            }).catch(() => {});
          }
        } catch (_) {}
      })();
    }

    res.status(201).json({ success: true, data: report });
  } catch (err) {
    await t.rollback();
    next(err);
  }
}

/** 9. Review State Report (Accept / Return for clarification) */
async function reviewStateReport(req, res, next) {
  try {
    const { reportId } = req.params;
    const { action, clarification_note } = req.body;

    const report = await AdhocStateReport.findByPk(reportId, {
      include: [
        {
          model: AdhocStateAssignment,
          as: "state_assignment",
          include: [{ model: AdhocMasterAssignment, as: "master_assignment" }],
        },
      ],
    });
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const isSdo = isSdoOrAdmin(req.user);
    const userDept = req.user?.department_code;
    const masterDept = report.state_assignment?.master_assignment?.originating_department_code;
    const isOriginatingDept = !isSdo && !!userDept && (!masterDept || userDept === masterDept);

    if (!isSdo && !isOriginatingDept) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Only SDO or the Originating Department can review or acknowledge this report.",
      });
    }

    if (action === "accept" && !isSdo) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Only SDO can formally accept state reports. Department reviewers can Acknowledge or Return for clarification.",
      });
    }

    if (action === "return_for_clarification") {
      if (!clarification_note || !clarification_note.trim()) {
        return res.status(422).json({ success: false, message: "Clarification comment is required when returning report" });
      }
      await report.update({
        review_status: "returned_for_clarification",
        clarification_note: clarification_note.trim(),
        reviewed_by: req.user?.id || null,
        reviewed_by_name: req.user?.name || req.user?.staff_id || "Reviewer",
        reviewed_at: new Date(),
      });
      if (report.state_assignment) {
        await report.state_assignment.update({ progress_status: "awaiting_support" });
      }
    } else if (action === "accept") {
      await report.update({
        review_status: "accepted",
        clarification_note: clarification_note ? clarification_note.trim() : null,
        reviewed_by: req.user?.id || null,
        reviewed_by_name: req.user?.name || req.user?.staff_id || "Reviewer",
        reviewed_at: new Date(),
      });
    } else if (action === "acknowledge") {
      await report.update({
        review_status: "acknowledged",
        clarification_note: clarification_note ? clarification_note.trim() : null,
        reviewed_by: req.user?.id || null,
        reviewed_by_name: req.user?.name || req.user?.staff_id || "Department Reviewer",
        reviewed_at: new Date(),
      });
    } else {
      return res.status(422).json({ success: false, message: "Invalid review action" });
    }

    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

/** 10. Close State Assignment (SDO Only) */
async function closeStateAssignment(req, res, next) {
  try {
    const { stateAssignmentId } = req.params;
    const assignment = await AdhocStateAssignment.findByPk(stateAssignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, message: "State assignment not found" });
    }

    const { closure_remarks } = req.body;

    await assignment.update({
      closure_status: "closed",
      progress_status: "completed",
      closed_at: new Date(),
      closed_by: req.user?.id || null,
      closed_by_name: req.user?.name || req.user?.staff_id || "SDO Officer",
      closure_remarks: closure_remarks ? closure_remarks.trim() : null,
    });

    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
}

/** 11. Helper: List Departments for Dropdown */
async function listDepartments(_req, res, next) {
  try {
    const list = await Department.findAll({
      attributes: ["department_code", "name"],
      order: [["name", "ASC"]],
    });
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
}

/** 12. Helper: List States with Zones */
async function listStatesWithZones(_req, res, next) {
  try {
    const states = await StateOffice.findAll({
      attributes: ["code", "description", "zonal_code"],
      order: [["description", "ASC"]],
      include: [{ model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] }],
    });
    res.json({ success: true, data: states });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createMasterAssignment,
  updateMasterAssignment,
  listMasterAssignments,
  getMasterAssignment,
  dispatchToStates,
  listStateAssignments,
  getStateAssignment,
  submitStateReport,
  reviewStateReport,
  closeStateAssignment,
  listDepartments,
  listStatesWithZones,
};
