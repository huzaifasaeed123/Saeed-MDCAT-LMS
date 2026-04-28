const User           = require('../models/User');
const SystemSettings = require('../models/SystemSettings');
const { getBadge }   = require('./leaderboardCache');
const { pushToUser } = require('./sseManager');
const cacheService   = require('./cacheService');

const DEFAULTS = { post: 2, reply: 1, helpful: 1, answer: 15 };

// ── Cache placement ──────────────────────────────────────────────────────────
// Storage lives in cacheService under the 'pointValues' namespace (registered
// in cacheService.js). Never expires automatically — only invalidated when an
// admin saves new values via SettingsPage.
const NS  = 'pointValues';
const KEY = 'global';

const fetchFromDb = async () => {
  try {
    const s = await SystemSettings.findOne({ key: 'global' }).select('communityPoints').lean();
    return { ...DEFAULTS, ...(s?.communityPoints || {}) };
  } catch {
    return { ...DEFAULTS };
  }
};

const getPointValues = () => cacheService.remember(NS, KEY, null, fetchFromDb); // null TTL = never expires

// Call this after admin changes point values in settings.
const invalidatePointsCache = () => cacheService.invalidate(NS, KEY);

// Fire-and-forget point award. Pushes a `points_update` SSE event to the user
// so their personal points + badge update instantly. Does NOT touch the public
// leaderboard cache — that has its own 5-minute TTL (see leaderboardCache.js)
// and only refreshes on auto-expiry or manual user request.
//
// Positive delta: simple $inc.
// Negative delta: aggregation pipeline that floors communityPoints at 0.
const awardPoints = (userId, delta) => {
  if (!userId || !delta) return;
  const rounded = Math.round(delta);
  const update  = rounded < 0
    ? [{ $set: { communityPoints: { $max: [0, { $add: ['$communityPoints', rounded] }] } } }]
    : { $inc: { communityPoints: rounded } };

  // findOneAndUpdate returns the new doc, so we can read the fresh point total
  // without a second query — we use it to push the SSE update.
  User.findOneAndUpdate(
    { _id: userId },
    update,
    { new: true, projection: { communityPoints: 1 }, lean: true }
  ).then((updated) => {
    if (!updated) return;
    pushToUser(userId, 'points_update', {
      points: updated.communityPoints,
      badge:  getBadge(updated.communityPoints),
    });
  }).catch(console.error);
};

module.exports = { getPointValues, invalidatePointsCache, awardPoints };
