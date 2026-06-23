const { getOperationalData } = require("../services/operationalData.service");

const getOperationalDataHandler = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10);
    if (!year || year < 2000 || year > 2100) {
      return res.status(422).json({ success: false, message: "Valid year query parameter is required" });
    }

    const data = await getOperationalData(year, {
      state_id: req.query.state_id ? parseInt(req.query.state_id, 10) : undefined,
      zone_id: req.query.zone_id ? parseInt(req.query.zone_id, 10) : undefined,
      user: req.user,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = { getOperationalDataHandler };
