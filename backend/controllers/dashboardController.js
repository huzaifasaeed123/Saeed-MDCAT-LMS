// ── Dashboard summary endpoint ──────────────────────────────────────────────
// One endpoint, role-aware response. Every query runs in Promise.all for
// minimum latency. Results are cached:
//   • Students/teachers: 3-minute per-user cache (dashboardCache.user)
//   • Admins:            15-minute global cache (dashboardCache.admin)
//
// Designed to deliberately AVOID:
//   • $lookup joins (use IDs + small follow-up reads via cache when needed)
//   • Full-collection scans (every aggregation is bound by indexed filters)
//   • Per-request leaderboard recompute (read from LeaderboardUserRank, which
//     is written by the leaderboardJob cron, not by this endpoint)
// ─────────────────────────────────────────────────────────────────────────────

const mongoose                = require('mongoose');
const User                    = require('../models/User');
const UserTestAttempt         = require('../models/UserTestAttempt');
const UserMcqHistory          = require('../models/UserMcqHistory');
const Test                    = require('../models/TestModel');
const MCQ                     = require('../models/McqModel');
const QuestionBank            = require('../models/QuestionBankModel');
const Course                  = require('../models/CourseModel');
const Announcement            = require('../models/Announcement');
const Post                    = require('../models/Post');
const Reply                   = require('../models/Reply');
const Conversation            = require('../models/Conversation');
const LeaderboardUserRank     = require('../models/LeaderboardUserRank');
const MCQReport               = require('../models/MCQReport');
const Notification            = require('../models/Notification');

const dashboardCache          = require('../utils/dashboardCache');
const boardSnapshotCache      = require('../utils/boardSnapshotCache');
const LeaderboardSnapshot     = require('../models/LeaderboardSnapshot');
const { getBadge }            = require('../utils/leaderboardCache');

// 30-second spam-click guard for admin refresh — same pattern as leaderboardCache.
const ADMIN_REFRESH_COOLDOWN_MS = 30 * 1000;

// ── Helpers ─────────────────────────────────────────────────────────────────

const sevenDaysAgo = () => new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
const thirtyDaysAgo = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const todayStart = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

const round1 = (n) => Math.round((n || 0) * 10) / 10;
const pctOf = (num, den) => den > 0 ? round1((num / den) * 100) : 0;

// Total number of users with an all-time leaderboard rank — used for
// percentile calc. Reads from the in-memory boardSnapshotCache populated
// by leaderboardJob; falls back to a single LeaderboardSnapshot read if
// cache is cold (server just started). Never counts LeaderboardUserRank
// directly — that's an O(n) scan and was the bottleneck this replaces.
async function getAlltimeTotalRanked() {
  const cached = boardSnapshotCache.getSnapshot('alltime', null);
  if (cached && typeof cached.totalRanked === 'number') return cached.totalRanked;

  const snap = await LeaderboardSnapshot
    .findOne({ type: 'alltime', subjectTitle: null })
    .select('totalRanked entries computedAt periodStart')
    .lean();
  if (!snap) return 0;
  boardSnapshotCache.setSnapshot('alltime', null, snap);
  return snap.totalRanked || 0;
}

// ── STUDENT SUMMARY ─────────────────────────────────────────────────────────
// 7 queries in parallel (was 9 — merged Reply count+helpful into one aggregate,
// and totalRanked now comes from boardSnapshotCache, not a countDocuments).
// Heavy lifting is two facet aggregations (testStats + mcqStats); the rest
// are bounded reads.
async function buildStudentSummary(userId) {
  const oid    = new mongoose.Types.ObjectId(userId);
  const weekAgo = sevenDaysAgo();

  const [
    testFacet,        // aggregate completed/in-progress/avg/weekly from UserTestAttempt
    mcqFacet,         // lifetime + recent MCQ history from UserMcqHistory
    recentAttempts,   // last 5 completed attempts (with test populate)
    rankAllTime,      // LeaderboardUserRank for type=alltime
    userDoc,          // small projection — communityPoints + courseAccess length
    postsCount,
    replyAgg,         // count + helpful sum in ONE aggregate
  ] = await Promise.all([
    // ── Test stats facet ────────────────────────────────────────────────
    UserTestAttempt.aggregate([
      { $match: { user: oid } },
      { $facet: {
          rollup: [
            { $group: {
                _id: null,
                total:        { $sum: 1 },
                completed:    { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                inProgress:   { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
                avgScore:     { $avg: { $cond: [{ $eq: ['$status', 'completed'] }, '$scorePercentage', null] } },
                timeSpentSec: { $sum: '$totalTimeSpent' },
            }},
          ],
          weekly: [
            { $match: { status: 'completed', createdAt: { $gte: weekAgo } } },
            { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: '$scorePercentage' } } },
          ],
      }},
    ]),
    // ── MCQ history facet ───────────────────────────────────────────────
    UserMcqHistory.aggregate([
      { $match: { user: oid } },
      { $facet: {
          lifetime: [
            { $group: {
                _id: null,
                uniqueMcqs:     { $sum: 1 },
                totalAttempts:  { $sum: '$totalAttempts' },
                correctCount:   { $sum: '$correctCount' },
                incorrectCount: { $sum: '$incorrectCount' },
                omittedCount:   { $sum: '$omittedCount' },
                markedForReview:{ $sum: { $cond: ['$markedForReview', 1, 0] } },
                savedCount:     { $sum: { $cond: ['$saved', 1, 0] } },
            }},
          ],
          weekly: [
            { $match: { lastAttemptedAt: { $gte: weekAgo } } },
            { $count: 'mcqsTouched' },
          ],
      }},
    ]),
    // ── Recent 5 completed attempts ──────────────────────────────────────
    UserTestAttempt.find({ user: oid, status: 'completed' })
      .sort({ endTime: -1, createdAt: -1 })
      .limit(5)
      .populate('test', 'title totalQuestions')
      .select('test scorePercentage score maxScore answeredCount totalTimeSpent endTime createdAt mode')
      .lean(),
    // ── User's all-time leaderboard rank (O(1) indexed read) ────────────
    LeaderboardUserRank.findOne({ userId: oid, type: 'alltime', subjectTitle: null })
      .lean(),
    // ── User doc for communityPoints + courseAccess count ────────────────
    User.findById(oid).select('communityPoints courseAccess coursesGrantAll').lean(),
    // ── Community engagement: posts count + (replies count + helpful sum) ─
    // Reply count + helpful received are fused into ONE aggregate so we make
    // 2 community calls instead of 3.
    Post.countDocuments({ author: oid }),
    Reply.aggregate([
      { $match: { author: oid } },
      { $group: { _id: null, count: { $sum: 1 }, helpful: { $sum: '$helpfulCount' } } },
    ]),
  ]);

  // Unwrap facet rollups
  const tr = testFacet[0]?.rollup?.[0]  || { total: 0, completed: 0, inProgress: 0, avgScore: null, timeSpentSec: 0 };
  const tw = testFacet[0]?.weekly?.[0]  || { count: 0, avg: null };
  const ml = mcqFacet[0]?.lifetime?.[0] || { uniqueMcqs: 0, totalAttempts: 0, correctCount: 0, incorrectCount: 0, omittedCount: 0, markedForReview: 0, savedCount: 0 };
  const mw = mcqFacet[0]?.weekly?.[0]   || { mcqsTouched: 0 };
  const ra = replyAgg[0] || { count: 0, helpful: 0 };

  const accuracy = ml.correctCount + ml.incorrectCount > 0
    ? pctOf(ml.correctCount, ml.correctCount + ml.incorrectCount)
    : 0;

  // Total ranked users for percentile — read from the alltime LeaderboardSnapshot
  // (in-memory boardSnapshotCache, populated by leaderboardJob). No DB round-trip
  // when the cache is warm; one indexed read on the first cold request.
  const totalRanked = rankAllTime ? await getAlltimeTotalRanked() : 0;

  const points = userDoc?.communityPoints || 0;

  return {
    testStats: {
      total:        tr.total,
      completed:    tr.completed,
      inProgress:   tr.inProgress,
      avgScore:     round1(tr.avgScore),
      timeSpentSec: tr.timeSpentSec,
      weekCount:    tw.count,
      weekAvg:      round1(tw.avg),
    },
    mcqStats: {
      uniqueMcqs:     ml.uniqueMcqs,
      totalAttempts:  ml.totalAttempts,
      correctCount:   ml.correctCount,
      incorrectCount: ml.incorrectCount,
      omittedCount:   ml.omittedCount,
      markedForReview:ml.markedForReview,
      savedCount:     ml.savedCount,
      accuracy,
      weekTouched:    mw.mcqsTouched,
    },
    recentAttempts: recentAttempts.map((a) => ({
      id:             a._id,
      title:          a.test?.title || 'Untitled test',
      totalQuestions: a.test?.totalQuestions || 0,
      scorePct:       round1(a.scorePercentage),
      score:          a.score,
      maxScore:       a.maxScore,
      answeredCount:  a.answeredCount,
      mode:           a.mode,
      timeSpentSec:   a.totalTimeSpent,
      finishedAt:     a.endTime || a.createdAt,
    })),
    leaderboard: rankAllTime ? {
      rank:           rankAllTime.rank,
      totalRanked,
      percentile:     totalRanked > 0 ? round1(100 - ((rankAllTime.rank - 1) / totalRanked) * 100) : 0,
      score:          rankAllTime.score,
      accuracy:       round1(rankAllTime.accuracy),
      totalAttempted: rankAllTime.totalAttempted,
      correctCount:   rankAllTime.correctCount,
    } : null,
    community: {
      points,
      badge:           getBadge(points),
      postsCreated:    postsCount,
      repliesCreated:  ra.count,
      helpfulReceived: ra.helpful,
    },
    courses: {
      hasAll:    !!userDoc?.coursesGrantAll,
      unlocked:  userDoc?.coursesGrantAll ? null : (userDoc?.courseAccess?.length || 0),
    },
  };
}

// ── TEACHER SUMMARY ─────────────────────────────────────────────────────────
// Like student summary but with teaching counters. Teachers also have
// community engagement so we reuse the same Post/Reply queries.
async function buildTeacherSummary(userId) {
  const oid     = new mongoose.Types.ObjectId(userId);
  const weekAgo = sevenDaysAgo();

  const [
    testsCreated,
    mcqsCreated,
    reportsOpen,
    reportsHandledByMe,
    recentMyTests,
    recentReports,
    userDoc,
    postsCount,
    repliesCount,
    answersMarked,         // replies of mine marked as best-answer
    studentEngagement,     // weekly attempts on my tests
  ] = await Promise.all([
    Test.countDocuments({ createdBy: oid }),
    MCQ.countDocuments({ createdBy: oid }),
    MCQReport.countDocuments({ status: { $in: ['open', 'active'] } }),
    MCQReport.countDocuments({ handledBy: oid }),
    Test.find({ createdBy: oid })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title totalQuestions status createdAt')
      .lean(),
    MCQReport.find({ status: { $in: ['open', 'active'] } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('reportedBy', 'fullName')
      .populate('mcq', 'questionText')
      .select('reportedBy mcq reason status createdAt')
      .lean()
      .catch(() => []),
    User.findById(oid).select('communityPoints').lean(),
    Post.countDocuments({ author: oid }),
    Reply.countDocuments({ author: oid }),
    Reply.countDocuments({ author: oid, isAnswer: true }).catch(() => 0),
    // Weekly attempts across tests this teacher created — bounded query
    Test.find({ createdBy: oid }).select('_id').lean().then(async (tests) => {
      if (!tests.length) return { attempts: 0, students: 0 };
      const ids = tests.map((t) => t._id);
      const agg = await UserTestAttempt.aggregate([
        { $match: { test: { $in: ids }, status: 'completed', createdAt: { $gte: weekAgo } } },
        { $group: { _id: null, attempts: { $sum: 1 }, students: { $addToSet: '$user' } } },
        { $project: { attempts: 1, students: { $size: '$students' } } },
      ]);
      return agg[0] || { attempts: 0, students: 0 };
    }),
  ]);

  const points = userDoc?.communityPoints || 0;

  return {
    teaching: {
      testsCreated,
      mcqsCreated,
      reportsOpen,
      reportsHandledByMe,
      answersMarked,
    },
    studentEngagement: {
      weekAttempts: studentEngagement.attempts,
      weekStudents: studentEngagement.students,
    },
    recentTests: recentMyTests.map((t) => ({
      id: t._id, title: t.title, totalQuestions: t.totalQuestions,
      status: t.status, createdAt: t.createdAt,
    })),
    recentReports: (recentReports || []).map((r) => ({
      id:        r._id,
      reason:    r.reason,
      status:    r.status,
      reporter:  r.reportedBy?.fullName || 'Unknown',
      questionPreview: (r.mcq?.questionText || '').slice(0, 90),
      createdAt: r.createdAt,
    })),
    community: {
      points,
      badge:          getBadge(points),
      postsCreated:   postsCount,
      repliesCreated: repliesCount,
    },
  };
}

// ── ADMIN SUMMARY ───────────────────────────────────────────────────────────
// Global cached value — every admin sees the same numbers. 15-minute TTL.
async function buildAdminSummary() {
  const weekAgo  = sevenDaysAgo();
  const monthAgo = thirtyDaysAgo();
  const dayStart = todayStart();

  const [
    userCounts,    // total + per-role + new in last 7d/30d
    courseTotal,
    testTotal,
    mcqTotal,
    qbTotal,
    announceTotal,
    activityFacet, // attempts/posts/messages this week + today
    mcqReportsOpen,
    topStudents,   // top 5 from leaderboard
    recentSignups, // last 5 users
  ] = await Promise.all([
    User.aggregate([
      { $facet: {
          byRole: [{ $group: { _id: '$role', n: { $sum: 1 } } }],
          recent: [
            { $group: {
                _id: null,
                total:        { $sum: 1 },
                signupsWeek:  { $sum: { $cond: [{ $gte: ['$createdAt', weekAgo] }, 1, 0] } },
                signupsMonth: { $sum: { $cond: [{ $gte: ['$createdAt', monthAgo] }, 1, 0] } },
            }},
          ],
      }},
    ]),
    Course.countDocuments({}),
    Test.countDocuments({}),
    MCQ.countDocuments({}),
    QuestionBank.countDocuments({}),
    Announcement.countDocuments({}),
    Promise.all([
      UserTestAttempt.countDocuments({ status: 'completed', createdAt: { $gte: weekAgo } }),
      UserTestAttempt.countDocuments({ status: 'completed', createdAt: { $gte: dayStart } }),
      Post.countDocuments({ createdAt: { $gte: weekAgo } }),
      Conversation.countDocuments({ lastMessageAt: { $gte: weekAgo } }),
    ]).then(([attemptsWeek, attemptsToday, postsWeek, convosWeek]) => ({
      attemptsWeek, attemptsToday, postsWeek, convosWeek,
    })),
    MCQReport.countDocuments({ status: { $in: ['open', 'active'] } }),
    LeaderboardUserRank.find({ type: 'alltime', subjectTitle: null })
      .sort({ rank: 1 })
      .limit(5)
      .populate('userId', 'fullName profilePicture')
      .lean(),
    User.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select('fullName email role createdAt profilePicture')
      .lean(),
  ]);

  // Roll up user-counts facet
  const byRoleMap = {};
  for (const row of userCounts[0]?.byRole || []) byRoleMap[row._id] = row.n;
  const userRecent = userCounts[0]?.recent?.[0] || { total: 0, signupsWeek: 0, signupsMonth: 0 };

  return {
    platform: {
      totalUsers:    userRecent.total,
      students:      byRoleMap.student || 0,
      teachers:      byRoleMap.teacher || 0,
      admins:        byRoleMap.admin   || 0,
      signupsWeek:   userRecent.signupsWeek,
      signupsMonth:  userRecent.signupsMonth,
    },
    content: {
      totalCourses:        courseTotal,
      totalTests:          testTotal,
      totalMcqs:           mcqTotal,
      totalQuestionBanks:  qbTotal,
      totalAnnouncements:  announceTotal,
    },
    activity: {
      attemptsToday:    activityFacet.attemptsToday,
      attemptsThisWeek: activityFacet.attemptsWeek,
      postsThisWeek:    activityFacet.postsWeek,
      conversationsThisWeek: activityFacet.convosWeek,
      mcqReportsOpen,
    },
    topStudents: topStudents.map((r) => ({
      id:        r.userId?._id || r.userId,
      name:      r.userId?.fullName || 'Anonymous',
      picture:   r.userId?.profilePicture || null,
      rank:      r.rank,
      score:     r.score,
      accuracy:  round1(r.accuracy),
      attempted: r.totalAttempted,
    })),
    recentSignups: recentSignups.map((u) => ({
      id:        u._id,
      name:      u.fullName,
      email:     u.email,
      role:      u.role,
      picture:   u.profilePicture || null,
      joinedAt:  u.createdAt,
    })),
  };
}

// ─── GET /api/dashboard/summary ─────────────────────────────────────────────
// Role-aware. Students/teachers get personal data via stale-while-revalidate
// (3-min fresh window, 10-min stale window with background rebuild). Admins
// get a permanently-cached global summary; only the manual refresh button
// invalidates it.
exports.getSummary = async (req, res) => {
  try {
    const role   = req.user.role;
    const userId = req.user.id;

    if (role === 'admin') {
      const cached = dashboardCache.getAdmin();
      if (cached) {
        return res.json({ success: true, cached: true, role: 'admin', data: cached });
      }
      const fresh = await buildAdminSummary();
      dashboardCache.setAdmin(fresh);
      return res.json({ success: true, cached: false, role: 'admin', data: fresh });
    }

    // Student / teacher — stale-while-revalidate.
    const buildFn = role === 'teacher' ? buildTeacherSummary : buildStudentSummary;
    const cached  = dashboardCache.getUser(userId);

    if (cached.hit === 'fresh') {
      return res.json({ success: true, cached: true, role, data: cached.value });
    }

    if (cached.hit === 'stale') {
      // Serve the stale value immediately, rebuild in the background.
      res.json({ success: true, cached: true, stale: true, role, data: cached.value });
      if (dashboardCache.markRebuildStarted(userId)) {
        buildFn(userId)
          .then((fresh) => dashboardCache.setUser(userId, fresh))
          .catch((e)    => console.error('dashboard SWR rebuild failed:', e))
          .finally(()   => dashboardCache.markRebuildDone(userId));
      }
      return;
    }

    // Cold miss — synchronous build.
    const fresh = await buildFn(userId);
    dashboardCache.setUser(userId, fresh);
    res.json({ success: true, cached: false, role, data: fresh });
  } catch (err) {
    console.error('dashboard.getSummary error:', err);
    res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
};

// ─── POST /api/dashboard/summary/refresh ────────────────────────────────────
// "Refresh" button on the dashboard. Force a rebuild + return the new value.
//
// Admins: this is the ONLY way the admin cache is invalidated. Guarded by a
// 30s spam-click cooldown so rapid clicks don't trigger repeated rebuilds.
// Students/teachers: just drops the user's cache entry and falls into the
// normal synchronous build below.
exports.refreshSummary = async (req, res) => {
  try {
    const role = req.user.role;

    if (role === 'admin') {
      const builtAt = dashboardCache.getAdminBuiltAt();
      const age     = Date.now() - builtAt;
      if (builtAt > 0 && age < ADMIN_REFRESH_COOLDOWN_MS) {
        // Recently refreshed — return current cached value without a rebuild.
        const cached = dashboardCache.getAdmin();
        return res.json({
          success: true,
          cached: true,
          throttled: true,
          role: 'admin',
          data: cached,
          retryAfterMs: ADMIN_REFRESH_COOLDOWN_MS - age,
        });
      }
      dashboardCache.invalidateAdmin();
    } else {
      dashboardCache.invalidateUser(req.user.id);
    }
    return exports.getSummary(req, res);
  } catch (err) {
    console.error('dashboard.refreshSummary error:', err);
    res.status(500).json({ success: false, message: 'Failed to refresh dashboard' });
  }
};

// Internal — exposed for cache-invalidation hooks in other controllers.
exports._helpers = { buildStudentSummary, buildTeacherSummary, buildAdminSummary };
