const { searchProviders, syncFromNhia, ensureSynced } = require("../services/nhiaAccreditationSync");

const listProviders = async (req, res, next) => {
  try {
    const type = req.query.type === "hcp" ? "hcp" : "hmo";
    await ensureSynced();
    const rows = await searchProviders({
      type,
      q: req.query.q,
      limit: req.query.limit,
      state_id: req.query.state_id,
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const syncProviders = async (req, res, next) => {
  try {
    const result = await syncFromNhia();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

module.exports = { listProviders, syncProviders };
