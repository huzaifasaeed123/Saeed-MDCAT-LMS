const Notification = require('../models/Notification');
const { pushToUser } = require('../utils/sseManager');

// ── GET /api/community/notifications ─────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = 20;
    const skip   = (page - 1) * limit;

    const raw = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .lean();

    const hasMore = raw.length > limit;
    const data    = hasMore ? raw.slice(0, limit) : raw;

    res.json({ success: true, data, hasMore, page });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── PUT /api/community/notifications/read ─────────────────────────────────────
// Mark all unread notifications as read.
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );
    // Push to client so badge resets to 0 immediately
    pushToUser(req.user.id, 'notifications_read', {});
    res.json({ success: true });
  } catch (err) {
    console.error('markAllRead error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── PUT /api/community/notifications/:id/read ─────────────────────────────────
exports.markOneRead = async (req, res) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, recipient: req.user.id },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('markOneRead error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
