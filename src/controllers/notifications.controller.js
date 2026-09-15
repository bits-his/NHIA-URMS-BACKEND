const { ensureNotificationTable, AppNotification } = require("../utils/notify");

module.exports = {
  listMine: async (req, res, next) => {
    try {
      await ensureNotificationTable();
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
      const rows = await AppNotification.findAll({
        where: { user_id: userId },
        order: [["created_at", "DESC"]],
        limit: 100,
      });
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  },

  markRead: async (req, res, next) => {
    try {
      await ensureNotificationTable();
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
      const row = await AppNotification.findOne({ where: { id: req.params.id, user_id: userId } });
      if (!row) return res.status(404).json({ success: false, message: "Notification not found" });
      await row.update({ read: true });
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  },

  markAllRead: async (req, res, next) => {
    try {
      await ensureNotificationTable();
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
      await AppNotification.update({ read: true }, { where: { user_id: userId, read: false } });
      res.json({ success: true });
    } catch (err) { next(err); }
  },
};
