const jwt          = require('jsonwebtoken');
const mongoose     = require('mongoose');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const { addClient, removeClient, clientCount } = require('../utils/sseManager');
const { updateLeaderboardCache } = require('../utils/leaderboardCache');

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
  addClient(userId, res);
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
  ])
    .then(async ([msgResult, unreadNotifs]) => {
      // If we got fewer than 10 unread notifications, that's the full count.
      // Otherwise we need a separate countDocuments to know the true total.
      const notifUnreadTotal = unreadNotifs.length < 10
        ? unreadNotifs.length
        : await Notification.countDocuments({ recipient: oid, isRead: false });

      try {
        res.write(`data: ${JSON.stringify({
          type:             'connected',
          userId,
          unreadTotal:      msgResult[0]?.total || 0,
          notifUnreadTotal,
          notifications:    unreadNotifs,   // up to 10 full unread notification bodies
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
