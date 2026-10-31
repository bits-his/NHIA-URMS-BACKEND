const { Op } = require("sequelize");
const {
  OfficeAccommodation,
  StateZonalOfficeProfile,
  StateOffice,
  ZonalOffice,
} = require("../models/active");
const { resolveOfficeGeo } = require("../utils/officeProfileGeo");

const includeGeo = [
  { model: ZonalOffice, as: "zone", attributes: ["zonal_code", "description"] },
  { model: StateOffice, as: "state", attributes: ["code", "description", "zonal_code"] },
];

function serializeAccommodation(row) {
  const j = row.toJSON ? row.toJSON() : row;
  return {
    ...j,
    rent_amount: j.rent_amount != null ? Number(j.rent_amount) : null,
  };
}

const listAccommodations = async (req, res, next) => {
  try {
    const geo = await resolveOfficeGeo(req.user, req.query);
    const where = {};
    if (geo.state_code) where.state_code = geo.state_code;
    else if (geo.zonal_code) where.zonal_code = geo.zonal_code;
    if (req.query.year || req.query.reporting_year) {
      where.reporting_year = Number(req.query.year || req.query.reporting_year);
    }
    if (req.query.profile_id) {
      where.profile_id = Number(req.query.profile_id);
    }

    const rows = await OfficeAccommodation.findAll({
      where,
      include: includeGeo,
      order: [["reporting_year", "DESC"], ["id", "ASC"]],
    });
    res.json({ success: true, data: rows.map(serializeAccommodation) });
  } catch (err) {
    next(err);
  }
};

const getAccommodation = async (req, res, next) => {
  try {
    const row = await OfficeAccommodation.findByPk(req.params.id, { include: includeGeo });
    if (!row) {
      return res.status(404).json({ success: false, message: "Accommodation record not found" });
    }
    res.json({ success: true, data: serializeAccommodation(row) });
  } catch (err) {
    next(err);
  }
};

const createAccommodation = async (req, res, next) => {
  try {
    const geo = await resolveOfficeGeo(req.user, req.body);
    if (!geo.state_code || !geo.zonal_code) {
      return res.status(400).json({ success: false, message: "State and zone are required" });
    }
    const reporting_year = Number(req.body.reporting_year || new Date().getFullYear());
    const ownership_status = req.body.ownership_status || "Rented";
    const isOwned = ownership_status === "NHIA-owned";

    let profileId = req.body.profile_id ? Number(req.body.profile_id) : null;
    if (!profileId) {
      const profile = await StateZonalOfficeProfile.findOne({
        where: { state_code: geo.state_code, reporting_year },
      });
      if (profile) profileId = profile.id;
    }

    const row = await OfficeAccommodation.create({
      profile_id: profileId,
      zonal_code: geo.zonal_code,
      state_code: geo.state_code,
      zone_id: geo.zone_id,
      state_id: geo.state_id,
      reporting_year,
      ownership_status,
      rent_amount: isOwned ? null : req.body.rent_amount || null,
      rent_expiry_date: isOwned ? null : req.body.rent_expiry_date || null,
      current_condition: req.body.current_condition || "Good",
      issue_description: req.body.issue_description || null,
      remarks: req.body.remarks || null,
      status: req.body.status || "draft",
      created_by: req.user?.name || req.user?.staff_id || null,
      created_by_user_id: req.user?.id || null,
    });

    const full = await OfficeAccommodation.findByPk(row.id, { include: includeGeo });
    res.status(201).json({ success: true, data: serializeAccommodation(full) });
  } catch (err) {
    next(err);
  }
};

const updateAccommodation = async (req, res, next) => {
  try {
    const row = await OfficeAccommodation.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Accommodation record not found" });
    }

    const ownership_status = req.body.ownership_status || row.ownership_status;
    const isOwned = ownership_status === "NHIA-owned";

    await row.update({
      ownership_status,
      rent_amount: isOwned ? null : req.body.rent_amount !== undefined ? req.body.rent_amount : row.rent_amount,
      rent_expiry_date: isOwned ? null : req.body.rent_expiry_date !== undefined ? req.body.rent_expiry_date : row.rent_expiry_date,
      current_condition: req.body.current_condition || row.current_condition,
      issue_description: req.body.issue_description !== undefined ? req.body.issue_description : row.issue_description,
      remarks: req.body.remarks !== undefined ? req.body.remarks : row.remarks,
      status: req.body.status || row.status,
    });

    const full = await OfficeAccommodation.findByPk(row.id, { include: includeGeo });
    res.json({ success: true, data: serializeAccommodation(full) });
  } catch (err) {
    next(err);
  }
};

const deleteAccommodation = async (req, res, next) => {
  try {
    const row = await OfficeAccommodation.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Accommodation record not found" });
    }
    await row.destroy();
    res.json({ success: true, message: "Accommodation record deleted" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listAccommodations,
  getAccommodation,
  createAccommodation,
  updateAccommodation,
  deleteAccommodation,
};

