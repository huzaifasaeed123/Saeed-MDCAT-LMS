const jwt          = require('jsonwebtoken');
const mongoose     = require('mongoose');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const Announcement = require('../models/Announcement');
const User         = require('../models/User');
const { _helpers: { visibleFilter: announcementVisibleFilter } } = require('./announcementController');
const { getLatestForRole: getCachedAnnouncements } = require('../utils/announcementsCache');
const { getDueCountAndStreak: getSyllabusBadge } = require('./syllabusTodayController');
const { addClient, removeClient, clientCount, getActiveCount } = require('../utils/sseManager');
const { updateLeaderboardCache } = require('../utils/leaderboardCache');
const userAccessCache = require('../utils/userAccessCache');

// ─── GET /api/stream?token=<accessToken> ─────────────────────────────────────
// Opens a persistent SSE connection for the authenticated user.
// The 'connected' event carries the initial unreadTotal so the frontend
// never needs to call GET /api/messages/unread — SSE owns the badge entirely.
//
// Supported push events (all modules use pushToUser from sseManager):
//   connected          → initial unread count for sidebar badge
//   new_message        → messaging module (badge +1, conversation list update)
//   messages_read      → messaging module (badge -N)
//   notification       → future notifications module
//   leaderboard_update → future leaderboard module
//   community_reply    → future communities module
// ─────────────────────────────────────────────────────────────────────────────
exports.openStream = (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    return res.status(401).end();
  }

  const userId = decoded.id;

  // ── SSE response headers ──────────────────────────────────────────────────
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders(); // open the pipe immediately — client starts listening

  // ── Register this connection ──────────────────────────────────────────────
  // role is forwarded so sseManager can maintain a separate admin set and
  // broadcast 'active_users' frames whenever connections change.
  addClient(userId, res, { role: decoded.role });
  console.log(`[SSE] connected: ${userId} | total users: ${clientCount()}`);

  // ── Heartbeat every 25s to keep connection alive through proxies ──────────
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); }
    catch { clearInterval(heartbeat); }
  }, 25000);

  // ── Send 'connected' with initial unread counts + inlined notifications ──
  // Three queries run in parallel:
  //   1. Aggregate of unread messages across conversations
  //   2. Latest 10 unread notifications (full bodies — frontend stores these
  //      so the bell dropdown opens with NO API call in the common case)
  // We derive notifUnreadTotal from the inlined list when len < 10, and only
  // run a separate countDocuments when there might be MORE than 10 unread
  // (since we capped the inline list to 10).
  const oid = new mongoose.Types.ObjectId(userId);
  const role = decoded.role; // packed into the access token at issue time

  Promise.all([
    Conversation.aggregate([
      { $match: { participants: oid } },
      { $project: { u: { $ifNull: [`$unreadCounts.${userId}`, 0] } } },
      { $group:   { _id: null, total: { $sum: '$u' } } },
    ]),
    Notification.find({ recipient: oid, isRead: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    // Latest 15 announcements visible to this user. Served from the per-role
    // in-memory cache → 0 DB hits on the hot SSE-connect path. Cache rebuilds
    // only when an admin/teacher mutates, or every 60s as a TTL safety net.
    getCachedAnnouncements(role),
    // The user's last-seen timestamp powers the unread badge below.
    User.findById(oid).select('announcementsSeenAt').lean(),
    // Syllabus dashboard tile: due-today count + revision streak. One indexed
    // countDocuments + one small aggregation on TopicRevisionLog (60-day window).
    getSyllabusBadge(userId),
    // Feature & course access — served from the in-memory userAccessCache.
    // Cache HIT here = 0 DB queries. On miss, one User.findById projection.
    userAccessCache.getOrLoad(userId),
  ])
    .then(async ([msgResult, unreadNotifs, recentAnnouncements, userDoc, syllabusBadge, accessCached]) => {
      // If we got fewer than 10 unread notifications, that's the full count.
      // Otherwise we need a separate countDocuments to know the true total.
      const notifUnreadTotal = unreadNotifs.length < 10
        ? unreadNotifs.length
        : await Notification.countDocuments({ recipient: oid, isRead: false });

      // Unread announcements = those newer than announcementsSeenAt. Derived
      // from the inlined list when len < 15, otherwise one countDocuments.
      const seenAt = userDoc?.announcementsSeenAt || new Date(0);
      let announcementUnreadCount;
      if (recentAnnouncements.length < 15) {
        announcementUnreadCount = recentAnnouncements.filter(
          (a) => new Date(a.createdAt) > seenAt
        ).length;
      } else {
        announcementUnreadCount = await Announcement.countDocuments({
          ...announcementVisibleFilter(role),
          createdAt: { $gt: seenAt },
        });
      }

      const accessShape = userAccessCache.toResponseShape(accessCached);

      try {
        // Admin-only: seed the initial live active-user count so the dashboard
        // renders correctly on first paint, without waiting up to 1.5s for the
        // first 'active_users' broadcast tick.
        const adminExtras = role === 'admin'
          ? { activeUsers: getActiveCount() }   // { users, connections }
          : {};

        res.write(`data: ${JSON.stringify({
          type:             'connected',
          userId,
          unreadTotal:      msgResult[0]?.total || 0,
          notifUnreadTotal,
          notifications:    unreadNotifs,         // up to 10 full unread notification bodies
          announcements:    recentAnnouncements,  // up to 15 visible announcements
          announcementUnreadCount,
          syllabus:         syllabusBadge,        // { dueCount, streak }
          // Re-sync feature/course access on every (re)connect — covers cases
          // where the user reopens the tab after an admin change while offline.
          featureAccess:    accessShape.featureAccess,
          coursesGrantAll:  accessShape.coursesGrantAll,
          courseAccess:     accessShape.courseAccess,
          ...adminExtras,
        })}\n\n`);
      } catch { /* connection closed before queries finished */ }
      // Prime leaderboard cache on first connection if empty
      updateLeaderboardCache().catch(() => {});
    })
    .catch(() => {
      try {
        res.write(`data: ${JSON.stringify({
          type: 'connected', userId,
          unreadTotal: 0, notifUnreadTotal: 0, notifications: [],
          announcements: [], announcementUnreadCount: 0,
          syllabus: { dueCount: 0, streak: 0 },
          featureAccess: { autoTest: false, community: false, videos: false, notes: false },
          coursesGrantAll: false,
          courseAccess:  [],
        })}\n\n`);
      } catch {}
    });

  // ── Cleanup on disconnect ─────────────────────────────────────────────────
  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(userId, res);
    console.log(`[SSE] disconnected: ${userId} | total users: ${clientCount()}`);
  });
};
