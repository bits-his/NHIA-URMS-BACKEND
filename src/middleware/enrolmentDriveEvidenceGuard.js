const path = require("path");
const { Op, fn, col, where } = require("sequelize");
const { EnrolmentDriveReport } = require("../models");

module.exports = async (req, res, next) => {
  if (!EnrolmentDriveReport) return next();
  try {
    const filePath = `/uploads${path.posix.normalize(decodeURIComponent(req.path).replaceAll("\\", "/"))}`;
    const record = await EnrolmentDriveReport.findOne({
      attributes: ["reference_id"],
      where: { [Op.or]: [where(fn("JSON_CONTAINS", fn("LOWER", col("supporting_documents")), JSON.stringify({ path: filePath.toLowerCase() })), 1), where(fn("JSON_CONTAINS", fn("LOWER", col("supporting_documents")), JSON.stringify(filePath.toLowerCase())), 1)] },
    });
    if (record) return res.status(404).json({ success: false, message: "Use the authenticated Enrolment Drives evidence download" });
    next();
  } catch (error) { next(error); }
};
