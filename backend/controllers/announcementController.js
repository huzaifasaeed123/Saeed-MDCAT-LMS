const Announcement = require('../models/Announcement');
const User         = require('../models/User');
const { pushToAll, pushToUsers } = require('../utils/sseManager');
const { invalidate: invalidateAnnouncementsCache } = require('../utils/announcementsCache');

// Map a user's role to the audience values they may see.
// Everyone always includes 'everyone'; specific role audiences are added
// on top — so an admin sees announcements targeted to admins AND to everyone.
const audienceFilterFor = (role) => {
  const list = ['everyone'];
  if (role === 'student') list.push('students');
  else if (role === 'teacher') list.push('teachers');
  else if (role === 'admin')   list.push('admins');
  return list;
};

// Server-side filter shared by list/count/connect paths. Excludes expired.
const visibleFilter = (role) => ({
  audience: { $in: audienceFilterFor(role) },
  $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
});

// ── GET /api/announcements?page=N ─────────────────────────────────────────────
// Paginated 15 per page, pinned bubbled to top, then newest. Single DB op
// using the limit+1 hasMore pattern — no countDocuments. Lean for speed.
exports.getAnnouncements = async (req, res) => {
  try {
    const role  = req.user.role;
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 15;
    const skip  = (page - 1) * limit;

    const raw = await Announcement.find(visibleFilter(role))
      .sort({ pinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .lean();

    const hasMore = raw.length > limit;
    const data    = hasMore ? raw.slice(0, limit) : raw;

    res.json({ success: true, data, hasMore, page });
  } catch (err) {
    console.error('getAnnouncements error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── PUT /api/announcements/seen ───────────────────────────────────────────────
// Resets the user's unread badge in one $set. Optimistic — frontend already
// zeroed the badge locally.
exports.markSeen = async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user.id },
      { $set: { announcementsSeenAt: new Date() } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('markSeen error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── Admin / staff endpoints ──────────────────────────────────────────────────

// Audience → role list for SSE broadcast. We avoid pushing to users who
// shouldn't see the announcement.
const broadcast = (announcement, type) => {
  const a = announcement.toObject ? announcement.toObject() : announcement;
  // 'everyone' = pushToAll. Otherwise we'd need to look up users by role,
  // which is a DB hit we don't want in the create path. We instead broadcast
  // to all connected sockets and let the client's audience filter drop it
  // (cheap on the client). Server still enforces visibility on every fetch.
  pushToAll(type, { announcement: a });
};

// ── POST /api/announcements ──────────────────────────────────────────────────
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, message, type, audience, link, buttonText, pinned, expiresAt } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const doc = await Announcement.create({
      title:    title.trim(),
      message:  (message || '').trim(),
      type:     ['info','test','update','urgent'].includes(type) ? type : 'info',
      audience: ['everyone','students','teachers','admins'].includes(audience) ? audience : 'everyone',
      link:     (link || '').trim(),
      buttonText: (buttonText || 'Open').trim(),
      pinned:   !!pinned,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy:     req.user.id,
      createdByName: req.user.fullName || '',
    });

    invalidateAnnouncementsCache();
    broadcast(doc, 'announcement_new');
    res.status(201).json({ success: true, data: doc.toObject() });
  } catch (err) {
    console.error('createAnnouncement error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── PUT /api/announcements/:id ───────────────────────────────────────────────
// Single op via findOneAndUpdate. Only the supplied fields are written.
exports.updateAnnouncement = async (req, res) => {
  try {
    const { title, message, type, audience, link, buttonText, pinned, expiresAt } = req.body;
    const update = {};
    if (title       !== undefined) update.title      = title.trim();
    if (message     !== undefined) update.message    = (message || '').trim();
    if (type        !== undefined && ['info','test','update','urgent'].includes(type)) update.type = type;
    if (audience    !== undefined && ['everyone','students','teachers','admins'].includes(audience)) update.audience = audience;
    if (link        !== undefined) update.link       = (link || '').trim();
    if (buttonText  !== undefined) update.buttonText = (buttonText || 'Open').trim();
    if (pinned      !== undefined) update.pinned     = !!pinned;
    if (expiresAt   !== undefined) update.expiresAt  = expiresAt ? new Date(expiresAt) : null;

    const doc = await Announcement.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, lean: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Announcement not found' });

    invalidateAnnouncementsCache();
    broadcast(doc, 'announcement_update');
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('updateAnnouncement error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── DELETE /api/announcements/:id ────────────────────────────────────────────
exports.deleteAnnouncement = async (req, res) => {
  try {
    const result = await Announcement.findByIdAndDelete(req.params.id).lean();
    if (!result) return res.status(404).json({ success: false, message: 'Announcement not found' });

    invalidateAnnouncementsCache();
    pushToAll('announcement_delete', { id: result._id });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteAnnouncement error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── PUT /api/announcements/:id/pin ───────────────────────────────────────────
// Body: { pinned: true|false } — toggle is cheaper than a fetch+update because
// the caller already knows the current value.
exports.togglePin = async (req, res) => {
  try {
    const pinned = !!req.body.pinned;
    const doc = await Announcement.findByIdAndUpdate(
      req.params.id,
      { $set: { pinned } },
      { new: true, lean: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Announcement not found' });

    invalidateAnnouncementsCache();
    broadcast(doc, 'announcement_update');
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('togglePin error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── Helpers reused by streamController on SSE connect ────────────────────────
// Exporting these lets the SSE 'connected' event hydrate the client without
// any extra round-trip — same pattern used for notifications.
exports._helpers = { audienceFilterFor, visibleFilter };
