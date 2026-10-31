const { Op } = require("sequelize");
const {
  ZonalOffice,
  StateOffice,
  StateZonalOfficeProfile,
  OfficeAccommodation,
  UtilityServiceReport,
  StateZonalFocalPerson,
} = require("../models/active");
const {
  buildStateOfficeListWhere,
  assertRecordAccess,
  applyScopeToBody,
} = require("../utils/stateOfficeScope");
const { removeAopFile } = require("../middleware/officeProfileUpload");
const { resolveOfficeGeo } = require("../utils/officeProfileGeo");

const includeGeo = [
  { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
  { model: StateOffice, as: "state", attributes: ["code", "description", "zonal_code"] },
];

function asJsonArray(v) {
  if (v == null || v === "") return null;
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function serialize(row) {
  const j = row.toJSON ? row.toJSON() : row;
  return {
    ...j,
    state_id: j.state_id || j.state_code,
    zone_id: j.zone_id || j.zonal_code,
    state_display_id: j.state_code ? `ST-${j.state_code}` : `ST-${j.state_id || ""}`,
    zone_display_id: j.zonal_code ? `ZN-${j.zonal_code}` : `ZN-${j.zone_id || ""}`,
    staff_members: asJsonArray(j.staff_members),
    accommodation_entries: asJsonArray(j.accommodation_entries),
    annual_budget: j.annual_budget == null ? null : Number(j.annual_budget),
    enrolment_target: j.enrolment_target == null ? null : Number(j.enrolment_target),
  };
}

function toInt(v, { allowNull = true } = {}) {
  if (v === undefined || v === null || v === "") return allowNull ? null : undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error("Numeric fields must be zero or a positive number");
    err.status = 400;
    throw err;
  }
  return Math.round(n);
}

function toMoney(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error("Annual Budget must be a valid number");
    err.status = 400;
    throw err;
  }
  return n;
}

function emailOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    const err = new Error("Enter a valid email address");
    err.status = 400;
    throw err;
  }
  return s;
}

function strOrNull(v, max) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return max ? s.slice(0, max) : s;
}

function parseJsonField(v, label) {
  if (v === undefined || v === null || v === "") return null;
  if (Array.isArray(v)) return v;
  if (typeof v === "object") return v;
  try {
    const parsed = JSON.parse(String(v));
    return parsed;
  } catch {
    const err = new Error(`${label} must be valid JSON`);
    err.status = 400;
    throw err;
  }
}

function normalizeStaffMembers(v) {
  const raw = parseJsonField(v, "Staff members");
  if (!raw) return null;
  if (!Array.isArray(raw)) {
    const err = new Error("Staff members must be a list");
    err.status = 400;
    throw err;
  }
  const rows = raw
    .map((row) => ({
      name: strOrNull(row?.name, 150),
      email: row?.email ? emailOrNull(row.email) : null,
      file_number: strOrNull(row?.file_number ?? row?.fileNumber, 80),
      unit: strOrNull(row?.unit, 150),
    }))
    .filter((row) => row.name || row.email || row.file_number || row.unit);
  return rows.length ? rows : null;
}

function isOwnedStatus(status) {
  const s = String(status || "").toLowerCase();
  return s.includes("owned") || s === "nhia-owned";
}

function normalizeAccommodation(v) {
  const raw = parseJsonField(v, "Office accommodation");
  if (!raw) return null;
  if (!Array.isArray(raw)) {
    const err = new Error("Office accommodation must be a list");
    err.status = 400;
    throw err;
  }
  const rows = raw
    .map((row) => {
      const ownershipStatus = strOrNull(row?.ownershipStatus || row?.ownership_status, 80) || "Rented";
      const owned = isOwnedStatus(ownershipStatus);
      return {
        ownershipStatus,
        rentAmount: owned || row?.rentAmount === "" || row?.rentAmount == null
          ? null
          : toMoney(row.rentAmount ?? row.rent_amount),
        rentExpiryDate: owned ? null : strOrNull(row?.rentExpiryDate ?? row?.rent_expiry_date, 20),
        currentCondition: strOrNull(row?.currentCondition ?? row?.current_condition, 80) || "Good",
        issueDescription: strOrNull(row?.issueDescription ?? row?.issue_description, 2000),
        remarks: strOrNull(row?.remarks, 2000),
      };
    })
    .filter((row) =>
      row.ownershipStatus || row.rentAmount != null || row.rentExpiryDate || row.currentCondition || row.remarks
    );
  return rows.length ? rows : null;
}

async function syncAccommodationTable(profile, accommodationEntries, user) {
  if (!accommodationEntries || !Array.isArray(accommodationEntries)) return;
  try {
    // Delete existing accommodations linked to this profile
    await OfficeAccommodation.destroy({ where: { profile_id: profile.id } });
    for (const item of accommodationEntries) {
      await OfficeAccommodation.create({
        profile_id: profile.id,
        zonal_code: profile.zonal_code,
        state_code: profile.state_code,
        zone_id: profile.zone_id,
        state_id: profile.state_id,
        reporting_year: profile.reporting_year,
        ownership_status: item.ownershipStatus || "Rented",
        rent_amount: item.rentAmount,
        rent_expiry_date: item.rentExpiryDate,
        current_condition: item.currentCondition || "Good",
        issue_description: item.issueDescription || null,
        remarks: item.remarks || null,
        status: profile.status === "approved" ? "approved" : "submitted",
        created_by: user?.name || user?.staff_id || null,
        created_by_user_id: user?.id || null,
      });
    }
  } catch (e) {
    console.error("[syncAccommodationTable] Error syncing to dedicated table:", e);
  }
}

function aopFields(file) {
  if (!file) return {};
  return {
    aop_original_name: file.originalname,
    aop_file_name: file.filename,
    aop_file_path: `/uploads/office-profiles/${file.filename}`,
    aop_mime: file.mimetype,
  };
}

function uniqueConflict(err) {
  return (
    err?.name === "SequelizeUniqueConstraintError" ||
    String(err?.original?.code || "") === "ER_DUP_ENTRY"
  );
}

const listProfiles = async (req, res, next) => {
  try {
    const geo = await resolveOfficeGeo(req.user, req.query);
    const where = {};
    if (geo.state_code) where.state_code = geo.state_code;
    else if (geo.zonal_code) where.zonal_code = geo.zonal_code;

    if (req.query.year || req.query.reporting_year) {
      where.reporting_year = Number(req.query.year || req.query.reporting_year);
    }
    if (req.query.status) {
      where.status = req.query.status;
    }
    if (req.query.q) {
      const q = `%${String(req.query.q).trim()}%`;
      where[Op.or] = [
        { coordinator_name: { [Op.like]: q } },
        { office_email: { [Op.like]: q } },
        { coordinator_email: { [Op.like]: q } },
        { office_address: { [Op.like]: q } },
      ];
    }

    const rows = await StateZonalOfficeProfile.findAll({
      where,
      include: includeGeo,
      order: [["reporting_year", "DESC"], ["id", "ASC"]],
    });
    res.json({ success: true, data: rows.map(serialize) });
  } catch (err) {
    next(err);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const isNum = /^\d+$/.test(req.params.id);
    let row = null;
    if (isNum) {
      row = await StateZonalOfficeProfile.findByPk(req.params.id, {
        include: [
          ...includeGeo,
          { model: OfficeAccommodation, as: "accommodations" },
          { model: UtilityServiceReport, as: "utility_reports" },
        ],
      });
    } else {
      // Could be state_code or lookup
      row = await StateZonalOfficeProfile.findOne({
        where: { state_code: req.params.id },
        include: [
          ...includeGeo,
          { model: OfficeAccommodation, as: "accommodations" },
          { model: UtilityServiceReport, as: "utility_reports" },
        ],
        order: [["reporting_year", "DESC"]],
      });
    }

    if (!row) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    // Attach focal persons for the state & year
    const focalPersons = await StateZonalFocalPerson.findAll({
      where: { state_code: row.state_code, reporting_year: row.reporting_year },
    });

    const data = serialize(row);
    data.focal_persons = focalPersons;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const createProfile = async (req, res, next) => {
  try {
    const geo = await resolveOfficeGeo(req.user, req.body);
    if (!geo.state_code || !geo.zonal_code) {
      return res.status(400).json({ success: false, message: "Zone and State are required" });
    }
    const reporting_year = toInt(req.body.reporting_year, { allowNull: false });
    if (!reporting_year) {
      return res.status(400).json({ success: false, message: "Reporting year is required" });
    }

    const staff_members = normalizeStaffMembers(req.body.staff_members);
    const accommodation_entries = normalizeAccommodation(req.body.accommodation_entries);
    const payload = {
      reporting_year,
      zonal_code: geo.zonal_code,
      state_code: geo.state_code,
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      staff_strength: staff_members?.length ?? toInt(req.body.staff_strength),
      coordinator_name: strOrNull(req.body.coordinator_name, 150),
      coordinator_phone: strOrNull(req.body.coordinator_phone, 40),
      coordinator_email: emailOrNull(req.body.coordinator_email),
      staff_members,
      office_address: strOrNull(req.body.office_address, 500),
      office_email: emailOrNull(req.body.office_email),
      enrolment_target: toInt(req.body.enrolment_target),
      annual_budget: toMoney(req.body.annual_budget),
      accommodation_entries,
      status: req.body.status || "draft",
      submission_date: req.body.status === "submitted" ? new Date().toISOString().slice(0, 10) : null,
      submitted_by: req.body.status === "submitted" ? req.user?.name || req.user?.staff_id : null,
      created_by: req.user?.name || req.user?.staff_id || null,
      created_by_user_id: req.user?.id || null,
      ...aopFields(req.file),
    };

    const row = await StateZonalOfficeProfile.create(payload);

    // Sync accommodations table
    if (accommodation_entries) {
      await syncAccommodationTable(row, accommodation_entries, req.user);
    }

    const full = await StateZonalOfficeProfile.findByPk(row.id, {
      include: [
        ...includeGeo,
        { model: OfficeAccommodation, as: "accommodations" },
      ],
    });
    res.status(201).json({ success: true, data: serialize(full) });
  } catch (err) {
    if (req.file) removeAopFile(`/uploads/office-profiles/${req.file.filename}`);
    if (uniqueConflict(err)) {
      return res.status(409).json({
        success: false,
        message: "A profile already exists for this state office and reporting year.",
      });
    }
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const row = await StateZonalOfficeProfile.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    const staff_members = req.body.staff_members !== undefined
      ? normalizeStaffMembers(req.body.staff_members)
      : row.staff_members;
    const accommodation_entries = req.body.accommodation_entries !== undefined
      ? normalizeAccommodation(req.body.accommodation_entries)
      : row.accommodation_entries;

    const updates = {
      staff_strength: Array.isArray(staff_members) ? staff_members.length : toInt(req.body.staff_strength),
      coordinator_name: strOrNull(req.body.coordinator_name, 150),
      coordinator_phone: strOrNull(req.body.coordinator_phone, 40),
      coordinator_email: emailOrNull(req.body.coordinator_email),
      staff_members,
      office_address: strOrNull(req.body.office_address, 500),
      office_email: emailOrNull(req.body.office_email),
      enrolment_target: toInt(req.body.enrolment_target),
      annual_budget: toMoney(req.body.annual_budget),
      accommodation_entries,
    };

    if (req.body.status) {
      updates.status = req.body.status;
      if (req.body.status === "submitted" && !row.submission_date) {
        updates.submission_date = new Date().toISOString().slice(0, 10);
        updates.submitted_by = req.user?.name || req.user?.staff_id;
      }
    }

    if (req.file) {
      removeAopFile(row.aop_file_path);
      Object.assign(updates, aopFields(req.file));
    } else if (String(req.body.remove_aop) === "true" || String(req.body.remove_aop) === "1") {
      removeAopFile(row.aop_file_path);
      updates.aop_original_name = null;
      updates.aop_file_name = null;
      updates.aop_file_path = null;
      updates.aop_mime = null;
    }

    await row.update(updates);

    if (accommodation_entries) {
      await syncAccommodationTable(row, accommodation_entries, req.user);
    }

    const full = await StateZonalOfficeProfile.findByPk(row.id, {
      include: [
        ...includeGeo,
        { model: OfficeAccommodation, as: "accommodations" },
      ],
    });
    res.json({ success: true, data: serialize(full) });
  } catch (err) {
    if (req.file) removeAopFile(`/uploads/office-profiles/${req.file.filename}`);
    if (uniqueConflict(err)) {
      return res.status(409).json({
        success: false,
        message: "A profile already exists for this state office and reporting year.",
      });
    }
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const row = await StateZonalOfficeProfile.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }
    const { status, coordinator_review_note } = req.body;
    const updates = { status };
    if (status === "submitted") {
      updates.submission_date = new Date().toISOString().slice(0, 10);
      updates.submitted_by = req.user?.name || req.user?.staff_id;
    } else if (status === "endorsed" || status === "approved" || status === "returned") {
      updates.coordinator_reviewed_by = req.user?.name || req.user?.staff_id;
      updates.coordinator_reviewed_at = new Date();
      if (coordinator_review_note !== undefined) {
        updates.coordinator_review_note = coordinator_review_note;
      }
    }
    await row.update(updates);
    const full = await StateZonalOfficeProfile.findByPk(row.id, { include: includeGeo });
    res.json({ success: true, data: serialize(full) });
  } catch (err) {
    next(err);
  }
};

const deleteProfile = async (req, res, next) => {
  try {
    const row = await StateZonalOfficeProfile.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }
    removeAopFile(row.aop_file_path);
    await row.destroy();
    res.json({ success: true, message: "Profile deleted" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  updateStatus,
  deleteProfile,
};
