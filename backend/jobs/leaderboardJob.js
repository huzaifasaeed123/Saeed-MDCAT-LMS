/**
 * Leaderboard background recompute job.
 * Runs immediately on server start, then every INTERVAL_MS (10 minutes).
 *
 * Key design decisions:
 *  - NO $unwind on UserTestAttempt.questionAttempts.
 *    UserTestAttempt.score  = correct count  (set at completeTest time)
 *    UserTestAttempt.maxScore = total MCQs   (set at completeTest time)
 *    Weekly/monthly/mostImproved aggregate these directly → orders-of-magnitude cheaper.
 *  - Computes ranks for ALL users, not just top 50.
 *    Top-50 goes into LeaderboardSnapshot (for fast display).
 *    All users go into LeaderboardUserRank (for personal rank lookup, O(1) indexed read).
 *  - QB title map is cached in Node.js memory (30-min TTL) — QuestionBanks rarely change.
 *  - Clears boardSnapshotCache after each run so the controller always reads fresh data.
 *
 * Score formula (F2, scaled 0–1000):
 *   adjusted_acc = (correct + z²/2) / (total + z²)   [Bayesian, z=1.65]
 *   volume       = min(total / cap, 1)                [linear cap]
 *   score        = round(adjusted_acc × 700 + volume × 300)
 *
 * Volume caps: alltime/subject=1000, monthly=300, weekly/mostimproved=70
 */

const mongoose            = require('mongoose');
const UserMcqHistory      = require('../models/UserMcqHistory');
const UserTestAttempt     = require('../models/UserTestAttempt');
const QuestionBank        = require('../models/QuestionBankModel');
const User                = require('../models/User');
const LeaderboardSnapshot = require('../models/LeaderboardSnapshot');
const LeaderboardUserRank = require('../models/LeaderboardUserRank');
const boardCache          = require('../utils/boardSnapshotCache');

const INTERVAL_MS = 10 * 60 * 1000;

// ─── Score helpers ────────────────────────────────────────────────────────────

function computeScore(correct, total, cap) {
  if (total === 0) return 0;
  const z           = 1.65;
  const adjustedAcc = (correct + (z * z) / 2) / (total + z * z);
  return Math.round(adjustedAcc * 700 + Math.min(total / cap, 1) * 300);
}

function calcAccuracy(correct, total) {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

// ─── QB title in-memory cache (30-min TTL) ────────────────────────────────────
// Maps `${qbId}_${subjectId}` → lowercase title.
// QuestionBanks change rarely; no need to re-read every job run.

let   _qbTitleMap    = null;
let   _qbTitleCacheAt = 0;
const QB_CACHE_TTL_MS = 30 * 60 * 1000;

async function getQbTitleMap() {
  if (_qbTitleMap && Date.now() - _qbTitleCacheAt < QB_CACHE_TTL_MS) {
    return _qbTitleMap;
  }
  const qbs = await QuestionBank.find().select('subjects').lean();
  const map  = {};
  for (const qb of qbs) {
    for (const subj of qb.subjects || []) {
      map[`${qb._id}_${subj._id}`] = subj.title.trim().toLowerCase();
    }
  }
  _qbTitleMap     = map;
  _qbTitleCacheAt = Date.now();
  return map;
}

// ─── User display-info lookup ─────────────────────────────────────────────────

async function getUserMap(userIds) {
  if (!userIds.length) return {};
  const users = await User.find({ _id: { $in: userIds } })
    .select('fullName profilePicture')
    .lean();
  const map = {};
  for (const u of users) {
    map[u._id.toString()] = { fullName: u.fullName, profilePicture: u.profilePicture || null };
  }
  return map;
}

// ─── Build snapshot entries (top 50) ─────────────────────────────────────────

function buildEntries(top50, userMap) {
  return top50.map((r, i) => ({
    rank:           i + 1,
    userId:         r.userId,
    fullName:       userMap[r.userId.toString()]?.fullName        || 'Unknown',
    profilePicture: userMap[r.userId.toString()]?.profilePicture || null,
    score:          r.score,
    accuracy:       r.accuracy,
    totalAttempted: r.totalAttempted,
    correctCount:   r.correctCount,
    delta:          r.delta ?? null,
  }));
}

// ─── Persist ALL user ranks into LeaderboardUserRank ─────────────────────────
// For cumulative boards (alltime, subject): upsert — data is always valid.
// For time-based boards (weekly, monthly, mostimproved): delete-then-insert
//   so users with no activity in the current window don't show stale ranks.

async function saveAllUserRanks(allScored, type, subjectTitle, timeBased = false) {
  if (!allScored.length) {
    if (timeBased) await LeaderboardUserRank.deleteMany({ type, subjectTitle: subjectTitle || null });
    return;
  }

  const key = { type, subjectTitle: subjectTitle || null };

  if (timeBased) {
    // Atomic-ish: delete old period data, insert fresh
    await LeaderboardUserRank.deleteMany(key);
    const docs = allScored.map((r) => ({
      userId:         r.userId,
      type,
      subjectTitle:   subjectTitle || null,
      rank:           r.rank,
      score:          r.score,
      accuracy:       r.accuracy,
      totalAttempted: r.totalAttempted,
      correctCount:   r.correctCount,
      incorrectCount: r.totalAttempted - r.correctCount,
      delta:          r.delta ?? null,
      computedAt:     new Date(),
    }));
    await LeaderboardUserRank.insertMany(docs, { ordered: false });
  } else {
    // Cumulative boards: upsert so every user's latest rank is always current
    const ops = allScored.map((r) => ({
      updateOne: {
        filter: { userId: r.userId, ...key },
        update: {
          $set: {
            rank:           r.rank,
            score:          r.score,
            accuracy:       r.accuracy,
            totalAttempted: r.totalAttempted,
            correctCount:   r.correctCount,
            incorrectCount: r.totalAttempted - r.correctCount,
            delta:          r.delta ?? null,
            computedAt:     new Date(),
          },
        },
        upsert: true,
      },
    }));
    await LeaderboardUserRank.bulkWrite(ops, { ordered: false });
  }
}

// ─── All-Time ─────────────────────────────────────────────────────────────────
// Source: UserMcqHistory (cumulative, already aggregated per user/MCQ)

async function recomputeAllTime() {
  const CAP  = 1000;
  const rows = await UserMcqHistory.aggregate([
    { $group: {
      _id:            '$user',
      // sum only answered MCQs (correct + incorrect) — omitted/skipped excluded
      totalAttempted: { $sum: { $add: ['$correctCount', '$incorrectCount'] } },
      correctCount:   { $sum: '$correctCount' },
    }},
  ]);

  const allScored = rows
    .map((r) => ({
      userId:         r._id,
      totalAttempted: r.totalAttempted,
      correctCount:   r.correctCount,
      accuracy:       calcAccuracy(r.correctCount, r.totalAttempted),
      score:          computeScore(r.correctCount, r.totalAttempted, CAP),
      delta:          null,
    }))
    .sort((a, b) => b.score - a.score);

  allScored.forEach((r, i) => { r.rank = i + 1; });

  const top50   = allScored.slice(0, 50);
  const userMap = await getUserMap(allScored.map((r) => r.userId));

  await LeaderboardSnapshot.findOneAndUpdate(
    { type: 'alltime', subjectTitle: null },
    { entries: buildEntries(top50, userMap), computedAt: new Date(), periodStart: null },
    { upsert: true },
  );
  await saveAllUserRanks(allScored, 'alltime', null, false);
}

// ─── Time-Based (weekly + monthly) ───────────────────────────────────────────
// Uses score + maxScore directly — no $unwind on questionAttempts.
// score    = correct count  (set by completeTest)
// maxScore = total MCQs     (set by completeTest)

async function recomputeTimeBased(type, cap, windowMs) {
  const now         = new Date();
  const periodStart = new Date(now.getTime() - windowMs);

  const rows = await UserTestAttempt.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: periodStart } } },
    { $group: {
      _id:            '$user',
      // answeredCount excludes skipped questions (set by completeTest).
      // $ifNull handles old records written before this field was added.
      totalAttempted: { $sum: { $ifNull: ['$answeredCount', '$maxScore'] } },
      correctCount:   { $sum: '$score' },
    }},
  ]);

  const allScored = rows
    .map((r) => ({
      userId:         r._id,
      totalAttempted: r.totalAttempted,
      correctCount:   r.correctCount,
      accuracy:       calcAccuracy(r.correctCount, r.totalAttempted),
      score:          computeScore(r.correctCount, r.totalAttempted, cap),
      delta:          null,
    }))
    .sort((a, b) => b.score - a.score);

  allScored.forEach((r, i) => { r.rank = i + 1; });

  const top50   = allScored.slice(0, 50);
  const userMap = await getUserMap(allScored.map((r) => r.userId));

  await LeaderboardSnapshot.findOneAndUpdate(
    { type, subjectTitle: null },
    { entries: buildEntries(top50, userMap), computedAt: new Date(), periodStart },
    { upsert: true },
  );
  await saveAllUserRanks(allScored, type, null, true);
}

// ─── Most Improved ────────────────────────────────────────────────────────────
// Current 7 days vs previous 7 days. Uses score + maxScore — no $unwind.

async function recomputeMostImproved() {
  const CAP          = 70;
  const now          = new Date();
  const currentStart = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const prevStart    = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const datePipeline = (gte, lt) => [
    { $match: {
      status:    'completed',
      createdAt: lt ? { $gte: gte, $lt: lt } : { $gte: gte },
    }},
    { $group: {
      _id:            '$user',
      // answeredCount excludes skipped; $ifNull handles pre-migration records
      totalAttempted: { $sum: { $ifNull: ['$answeredCount', '$maxScore'] } },
      correctCount:   { $sum: '$score' },
    }},
  ];

  const [currentRows, prevRows] = await Promise.all([
    UserTestAttempt.aggregate(datePipeline(currentStart, null)),
    UserTestAttempt.aggregate(datePipeline(prevStart, currentStart)),
  ]);

  const prevMap = {};
  for (const r of prevRows) prevMap[r._id.toString()] = r;

  const allScored = [];
  for (const cur of currentRows) {
    if (cur.totalAttempted < 10) continue;

    const prev         = prevMap[cur._id.toString()];
    const currentScore = computeScore(cur.correctCount, cur.totalAttempted, CAP);
    const prevScore    = prev && prev.totalAttempted >= 5
      ? computeScore(prev.correctCount, prev.totalAttempted, CAP)
      : 0;

    const delta          = currentScore - prevScore;
    const activityFactor = Math.min(cur.totalAttempted / CAP, 1);

    allScored.push({
      userId:         cur._id,
      totalAttempted: cur.totalAttempted,
      correctCount:   cur.correctCount,
      accuracy:       calcAccuracy(cur.correctCount, cur.totalAttempted),
      score:          Math.round(delta * (0.6 + 0.4 * activityFactor)),
      delta:          Math.round(delta),
    });
  }

  allScored.sort((a, b) => b.score - a.score);
  allScored.forEach((r, i) => { r.rank = i + 1; });

  const top50   = allScored.slice(0, 50);
  const userMap = await getUserMap(allScored.map((r) => r.userId));

  await LeaderboardSnapshot.findOneAndUpdate(
    { type: 'mostimproved', subjectTitle: null },
    { entries: buildEntries(top50, userMap), computedAt: new Date(), periodStart: currentStart },
    { upsert: true },
  );
  await saveAllUserRanks(allScored, 'mostimproved', null, true);
}

// ─── Subject-Wise ─────────────────────────────────────────────────────────────
// S2: title-merged across all QBs using the in-memory QB title map.

async function recomputeSubjectBoards() {
  const CAP            = 1000;
  const subjectTitleMap = await getQbTitleMap();

  const rows = await UserMcqHistory.aggregate([
    { $match: { qbSubjectId: { $exists: true, $ne: null } } },
    { $group: {
      _id:            { user: '$user', qbId: '$questionBankId', subjectId: '$qbSubjectId' },
      // sum only answered MCQs (correct + incorrect) — omitted/skipped excluded
      totalAttempted: { $sum: { $add: ['$correctCount', '$incorrectCount'] } },
      correctCount:   { $sum: '$correctCount' },
    }},
  ]);

  // Merge rows with the same title across QBs
  const byTitle = {};
  for (const r of rows) {
    const key   = `${r._id.qbId}_${r._id.subjectId}`;
    const title = subjectTitleMap[key];
    if (!title) continue;

    if (!byTitle[title]) byTitle[title] = {};
    const uid = r._id.user.toString();
    if (!byTitle[title][uid]) {
      byTitle[title][uid] = { userId: r._id.user, totalAttempted: 0, correctCount: 0 };
    }
    byTitle[title][uid].totalAttempted += r.totalAttempted;
    byTitle[title][uid].correctCount   += r.correctCount;
  }

  // Score + rank per title
  const allUserIds    = new Set();
  const scoredByTitle = {};

  for (const [title, usersMap] of Object.entries(byTitle)) {
    const allScored = Object.values(usersMap)
      .map((u) => ({
        ...u,
        accuracy: calcAccuracy(u.correctCount, u.totalAttempted),
        score:    computeScore(u.correctCount, u.totalAttempted, CAP),
        delta:    null,
      }))
      .sort((a, b) => b.score - a.score);

    allScored.forEach((r, i) => { r.rank = i + 1; });
    scoredByTitle[title] = allScored;
    allScored.forEach((r) => allUserIds.add(r.userId.toString()));
  }

  if (!Object.keys(scoredByTitle).length) return;

  const allIds  = [...allUserIds].map((id) => new mongoose.Types.ObjectId(id));
  const userMap = await getUserMap(allIds);

  // Snapshot upserts + user rank saves — run in parallel per subject
  const subjectTitles = Object.keys(scoredByTitle);

  // Delete stale subject user ranks for subjects we're about to rewrite
  if (subjectTitles.length > 0) {
    await LeaderboardUserRank.deleteMany({ type: 'subject', subjectTitle: { $in: subjectTitles } });
  }

  // Collect all rank docs across subjects for one bulk insert
  const allRankDocs = [];

  const snapshotOps = subjectTitles.map((title) => {
    const allScored = scoredByTitle[title];
    const top50     = allScored.slice(0, 50);

    for (const r of allScored) {
      allRankDocs.push({
        userId:         r.userId,
        type:           'subject',
        subjectTitle:   title,
        rank:           r.rank,
        score:          r.score,
        accuracy:       r.accuracy,
        totalAttempted: r.totalAttempted,
        correctCount:   r.correctCount,
        incorrectCount: r.totalAttempted - r.correctCount,
        delta:          null,
        computedAt:     new Date(),
      });
    }

    return LeaderboardSnapshot.findOneAndUpdate(
      { type: 'subject', subjectTitle: title },
      { entries: buildEntries(top50, userMap), computedAt: new Date(), periodStart: null },
      { upsert: true },
    );
  });

  await Promise.all(snapshotOps);
  if (allRankDocs.length > 0) {
    await LeaderboardUserRank.insertMany(allRankDocs, { ordered: false });
  }

  console.log(`[Leaderboard] ${subjectTitles.length} subject board(s) recomputed`);
}

// ─── Main recompute ───────────────────────────────────────────────────────────

async function runAll() {
  const t0 = Date.now();
  console.log('[Leaderboard] Recompute started...');
  try {
    await recomputeAllTime();
    await recomputeTimeBased('weekly',  70,  7  * 24 * 60 * 60 * 1000);
    await recomputeTimeBased('monthly', 300, 30 * 24 * 60 * 60 * 1000);
    await recomputeMostImproved();
    await recomputeSubjectBoards();

    // Invalidate in-memory snapshot cache so next request reads the fresh data
    boardCache.clearAll();

    console.log(`[Leaderboard] All boards done in ${Date.now() - t0}ms`);
  } catch (err) {
    console.error('[Leaderboard] Recompute error:', err.message);
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

function startLeaderboardJob() {
  runAll(); // immediate run on server start
  setInterval(runAll, INTERVAL_MS);
  console.log(`[Leaderboard] Job started — recomputes every ${INTERVAL_MS / 60000} min`);
}

module.exports = { startLeaderboardJob, runAll };
