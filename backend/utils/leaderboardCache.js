// ─── Leaderboard cache ─────────────────────────────────────────────────────────
// Domain wrapper around the generic cacheService. Storage lives in
// cacheService under the 'leaderboard' namespace (registered in cacheService.js).
// This file owns the domain logic only:
//   - 5-minute auto-refresh on read
//   - Manual refresh with 30s spam-click guard + SSE broadcast
//   - getBadge() tier helper
//
// Personal points (per-user) update instantly via SSE on awardPoints — see
// pointsService.js. Personal rank follows the slower model (recomputed on
// each leaderboard fetch, served from cache for top-10 users).
// ─────────────────────────────────────────────────────────────────────────────

const User          = require('../models/User');
const { pushToAll } = require('./sseManager');
const cacheService  = require('./cacheService');

const NS  = 'leaderboard';
const KEY = 'top10';

const TTL_MS                     = 5 * 60 * 1000; // 5 minutes
const MANUAL_REFRESH_COOLDOWN_MS = 30 * 1000;     // 30s spam-click guard

const getBadge = (pts = 0) => {
  if (pts >= 4000) return 'Pro';
  if (pts >= 3000) return 'Legend';
  if (pts >= 2000) return 'Expert';
  if (pts >= 1000) return 'Scholar';
  return 'Beginner';
};

// Domain state — not part of the cached value itself.
let updating          = false;
let lastManualRefresh = 0;

const computeTop10 = async () => {
  const top = await User.find({ role: 'student' })
    .select('fullName profilePicture communityPoints')
    .sort({ communityPoints: -1 })
    .limit(10)
    .lean();

  return top.map((u, i) => ({
    _id:             u._id,
    fullName:        u.fullName,
    profilePicture:  u.profilePicture || null,
    communityPoints: u.communityPoints || 0,
    badge:           getBadge(u.communityPoints),
    rank:            i + 1,
  }));
};

// Refresh storage from DB. Caller decides whether to broadcast.
const refreshLeaderboardCache = async () => {
  if (updating) {
    // Another refresh is already in flight — return whatever's cached.
    return cacheService.get(NS, KEY) || [];
  }
  updating = true;
  try {
    const fresh = await computeTop10();
    cacheService.set(NS, KEY, fresh, TTL_MS);
    return fresh;
  } catch (err) {
    console.error('[leaderboard] cache refresh error:', err);
    return cacheService.get(NS, KEY) || [];
  } finally {
    updating = false;
  }
};

// Auto-refresh on TTL expiry. Used by GET /api/community/leaderboard.
const getLeaderboard = async () => {
  const cached = cacheService.get(NS, KEY);
  if (cached) return cached;
  return refreshLeaderboardCache();
};

// Synchronous accessor — returns whatever's in cache, or empty array.
const getLeaderboardSync = () => cacheService.get(NS, KEY) || [];

// When does the cached top-10 expire? Exposed to the frontend so the UI can
// show "next refresh in N min."
const getCacheExpiry = () => cacheService.getExpiry(NS, KEY);

// Manual refresh (user clicks refresh button). Forces a refresh and broadcasts
// to all connected clients so everyone benefits from the new cached version.
// Throttled to 30 seconds to prevent spam-click storms.
const manualRefreshLeaderboard = async () => {
  const now = Date.now();
  if (now - lastManualRefresh < MANUAL_REFRESH_COOLDOWN_MS) {
    // Recently refreshed — return current cache, skip the DB hit + broadcast.
    return {
      leaderboard:  cacheService.get(NS, KEY) || [],
      refreshed:    false,
      cacheExpires: getCacheExpiry(),
    };
  }
  lastManualRefresh = now;
  const fresh = await refreshLeaderboardCache();
  pushToAll('leaderboard_update', { leaderboard: fresh, cacheExpires: getCacheExpiry() });
  return { leaderboard: fresh, refreshed: true, cacheExpires: getCacheExpiry() };
};

module.exports = {
  getBadge,
  getLeaderboard,
  getLeaderboardSync,
  getCacheExpiry,
  refreshLeaderboardCache,
  manualRefreshLeaderboard,
  // Backwards-compat alias — streamController imports `updateLeaderboardCache`
  // for cache priming on first SSE connect.
  updateLeaderboardCache: refreshLeaderboardCache,
};
