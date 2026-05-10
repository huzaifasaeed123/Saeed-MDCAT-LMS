const LeaderboardSnapshot = require('../models/LeaderboardSnapshot');
const LeaderboardUserRank = require('../models/LeaderboardUserRank');
const boardCache          = require('../utils/boardSnapshotCache');

// ── GET /api/leaderboard ──────────────────────────────────────────────────────
// DB reads per request:
//   Cache hit  → 0 reads for snapshot  + 1 indexed read for personal rank = 1 total
//   Cache miss → 1 read  for snapshot  + 1 indexed read for personal rank = 2 total
// No live aggregation. No $unwind. No QuestionBank scan. Ever.

exports.getLeaderboard = async (req, res) => {
  try {
    const { type = 'alltime' } = req.query;
    const subjectTitle = req.query.subjectTitle
      ? req.query.subjectTitle.trim().toLowerCase()
      : null;
    const userId = req.user._id;

    const validTypes = ['alltime', 'weekly', 'monthly', 'mostimproved', 'subject'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid leaderboard type' });
    }
    if (type === 'subject' && !subjectTitle) {
      return res.status(400).json({ success: false, message: 'subjectTitle required for subject leaderboard' });
    }

    // ── 1. Snapshot (top-50 entries) — served from in-memory cache when warm ──
    let snapshot = boardCache.getSnapshot(type, subjectTitle);
    if (!snapshot) {
      snapshot = await LeaderboardSnapshot.findOne({
        type,
        subjectTitle: type === 'subject' ? subjectTitle : null,
      }).lean();
      if (snapshot) boardCache.setSnapshot(type, subjectTitle, snapshot);
    }

    if (!snapshot) {
      return res.json({
        success: true,
        data: { entries: [], userRank: null, computedAt: null, periodStart: null, type, subjectTitle },
      });
    }

    // ── 2. Personal rank — check snapshot first, then LeaderboardUserRank ─────
    const userIdStr = userId.toString();
    const inTop     = snapshot.entries.find((e) => e.userId.toString() === userIdStr);

    let userRank;
    if (inTop) {
      userRank = {
        rank:           inTop.rank,
        score:          inTop.score,
        accuracy:       inTop.accuracy,
        totalAttempted: inTop.totalAttempted,
        correctCount:   inTop.correctCount,
        incorrectCount: inTop.totalAttempted - inTop.correctCount,
        delta:          inTop.delta,
      };
    } else {
      // Single O(1) indexed read — no aggregation, no $unwind
      const rankDoc = await LeaderboardUserRank.findOne({
        userId,
        type,
        subjectTitle: type === 'subject' ? subjectTitle : null,
      }).lean();

      userRank = rankDoc
        ? {
            rank:           rankDoc.rank,
            score:          rankDoc.score,
            accuracy:       rankDoc.accuracy,
            totalAttempted: rankDoc.totalAttempted,
            correctCount:   rankDoc.correctCount,
            incorrectCount: rankDoc.incorrectCount,
            delta:          rankDoc.delta,
          }
        : null;
    }

    res.json({
      success: true,
      data: {
        entries:      snapshot.entries,
        userRank,
        computedAt:   snapshot.computedAt,
        periodStart:  snapshot.periodStart,
        type,
        subjectTitle: snapshot.subjectTitle,
      },
    });
  } catch (err) {
    console.error('getLeaderboard error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/leaderboard/subjects ─────────────────────────────────────────────
// Returns subject titles that have an active snapshot.
// Served from in-memory cache when warm — 0 DB reads.

exports.getSubjectList = async (req, res) => {
  try {
    const cached = boardCache.getSubjects();
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const subjects = await LeaderboardSnapshot.find({ type: 'subject' })
      .select('subjectTitle computedAt')
      .lean();

    const data = subjects.map((s) => ({ title: s.subjectTitle, computedAt: s.computedAt }));
    boardCache.setSubjects(data);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
