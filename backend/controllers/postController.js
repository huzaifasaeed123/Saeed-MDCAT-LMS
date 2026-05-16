const mongoose      = require('mongoose');
const Post          = require('../models/Post');
const Reply         = require('../models/Reply');
const Notification  = require('../models/Notification');
const User          = require('../models/User');
const { awardPoints, getPointValues } = require('../utils/pointsService');
const cacheService  = require('../utils/cacheService');
// Image uploads reuse the platform-wide /api/upload-image endpoint (uploadController.js)

// ── Feed cache config ─────────────────────────────────────────────────────────
// The default feed (no category, no filter, no search, page 1) is identical
// for every user except the per-user `isSaved` / `myVoteIndex` fields, which
// are computed at enrichment time. We cache the raw post documents for 5 min
// and run enrichment per request — so all readers share the same DB query
// within a 5-minute window.
const FEED_NS      = 'feed';
const FEED_KEY     = 'default';
const FEED_TTL_MS  = 5 * 60 * 1000;

const isDefaultFeedView = (q, page) =>
  Object.keys(q).length === 0 && Number(page) === 1;

// Convenience: drop the cached feed. Called from any post mutation that could
// affect the default view.
const invalidateFeedCache = () => cacheService.invalidate(FEED_NS, FEED_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────
// Build a display-ready author object from the embedded snapshot + ObjectId.
// This avoids a User populate on every read.
const buildAuthor = (post) => ({
  _id: post.author,
  ...(post.authorSnapshot || {}),
});

const enrichPost = (post, userId) => {
  const p = { ...post };

  p.author = buildAuthor(post);
  delete p.authorSnapshot;

  p.isSaved = (post.savedBy || []).some((id) => id.toString() === userId);
  delete p.savedBy;

  if (post.poll?.options) {
    let totalVotes  = 0;
    let myVoteIndex = -1;

    const options = post.poll.options.map((opt, i) => {
      const voteCount = opt.votes?.length || 0;
      totalVotes += voteCount;
      if (opt.votes?.some((v) => v.toString() === userId)) myVoteIndex = i;
      return { _id: opt._id, text: opt.text, voteCount };
    });

    p.poll = {
      options,
      totalVotes,
      myVoteIndex,
      isQuizMode:    post.poll.isQuizMode,
      // Only reveal correct answer + explanation after the user has voted
      correctOption: (post.poll.isQuizMode && myVoteIndex !== -1) ? post.poll.correctOption : undefined,
      explanation:   (post.poll.isQuizMode && myVoteIndex !== -1) ? post.poll.explanation   : undefined,
    };
  }

  return p;
};

// ── GET /api/community/posts ──────────────────────────────────────────────────
exports.getPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, filter = 'all', search, page = 1 } = req.query;
    const limit = 10;
    const skip  = (Math.max(1, Number(page)) - 1) * limit;

    const q = {};

    if (category && category !== 'all') q.category = category;

    switch (filter) {
      case 'mine':          q.author = userId; break;
      case 'doubts':        q.type = 'doubt'; break;
      // Symmetric with `answered`: no type restriction. Matches any post that
      // hasn't been marked answered. $ne:true also covers missing field.
      // (The previous query required type:'doubt', which excluded discussions —
      // the default post type in the composer — so users posting discussions
      // never saw their posts in "Unanswered". Now any unanswered post shows.)
      case 'unanswered':    q.isAnswered = { $ne: true }; break;
      case 'answered':      q.isAnswered = true; break;
      case 'discussions':   q.type = 'discussion'; break;
      case 'announcements': q.type = 'announcement'; break;
      case 'pinned':        q.isPinned = true; break;
      case 'saved':         q.savedBy = new mongoose.Types.ObjectId(userId); break;
      case 'noreplies':     q.replyCount = 0; break;
      case 'digest':        q.createdAt = { $gte: new Date(Date.now() - 7 * 86400000) }; break;
      default: break;
    }

    // Search: regex on content + author name. The `$text` index couldn't search
    // author names because the snapshot is on the post doc, not the User join.
    // Regex is slower than $text but flexible and works on small/medium datasets.
    if (search?.trim()) {
      // Escape regex metacharacters so the query is treated as a literal string.
      const safe  = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      q.$or = [
        { content: regex },
        { 'authorSnapshot.fullName': regex },
      ];
    }

    // No populate — authorSnapshot is embedded on the post document.
    // For the default view (everyone gets the same feed) we cache the raw
    // post docs for 5 minutes. Per-user enrichment still runs every request.
    const fetchRaw = async () => {
      const raw = await Post.find(q)
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit + 1)
        .lean();
      return { raw, hasMore: raw.length > limit };
    };

    const { raw, hasMore } = isDefaultFeedView(q, page)
      ? await cacheService.remember(FEED_NS, FEED_KEY, FEED_TTL_MS, fetchRaw)
      : await fetchRaw();

    const posts = (hasMore ? raw.slice(0, limit) : raw).map((p) => enrichPost(p, userId));

    res.json({ success: true, data: posts, hasMore, page: Number(page) });
  } catch (err) {
    console.error('getPosts error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── POST /api/community/posts ─────────────────────────────────────────────────
exports.createPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, type, content, images = [], poll } = req.body;

    if (!category || !type) {
      return res.status(400).json({ success: false, message: 'category and type are required' });
    }
    if (type === 'announcement' && !['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admin and teachers can post announcements' });
    }
    if (!content?.trim() && images.length === 0 && type !== 'poll') {
      return res.status(400).json({ success: false, message: 'Post must have content or an image' });
    }
    if (type === 'poll') {
      if (!poll?.options || poll.options.length < 2) {
        return res.status(400).json({ success: false, message: 'Poll requires at least 2 options' });
      }
      if (poll.options.length > 5) {
        return res.status(400).json({ success: false, message: 'Poll can have at most 5 options' });
      }
      if (poll.isQuizMode && poll.correctOption == null) {
        return res.status(400).json({ success: false, message: 'Quiz mode requires selecting the correct answer' });
      }
    }

    let pollData;
    if (type === 'poll' && poll) {
      pollData = {
        options:       poll.options.map((o) => ({ text: o.text.trim(), votes: [] })),
        isQuizMode:    !!poll.isQuizMode,
        correctOption: poll.isQuizMode ? Number(poll.correctOption) : undefined,
        explanation:   poll.explanation?.trim() || '',
      };
    }

    // Snapshot includes communityPoints — this is the only field not in req.user,
    // so we read it once via a tiny projection. Stamps "user's standing at post time"
    // into the document so the feed can render badges without a populate join.
    const me = await User.findById(userId).select('communityPoints').lean();

    const authorSnapshot = {
      fullName:        req.user.fullName,
      role:            req.user.role,
      profilePicture:  req.user.profilePicture || null,
      communityPoints: me?.communityPoints || 0,
    };

    const post = await Post.create({
      author: userId,
      authorSnapshot,
      category, type,
      content: content?.trim() || '',
      images:  images.slice(0, 5),
      poll:    pollData,
    });

    // Build response from the just-created document — no second DB read.
    const responseDoc = post.toObject();

    // Drop the default-feed cache so the new post is visible on next fetch.
    invalidateFeedCache();
    // We do NOT drop the user's dashboard cache here. The 3-min SWR fresh window
    // is enough — a user creating a post doesn't expect their dashboard's
    // "postsCreated" counter to update instantly. Same reasoning for admin.

    // Award points + return the earned amount so the frontend can show a "+N points" toast.
    const pts = await getPointValues();   // cached, no DB call
    awardPoints(userId, pts.post);        // fire-and-forget

    res.status(201).json({
      success: true,
      data: enrichPost(responseDoc, userId),
      pointsEarned: pts.post,
    });
  } catch (err) {
    console.error('createPost error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── PUT /api/community/posts/:id ──────────────────────────────────────────────
// Single DB op via findOneAndUpdate (with author guard inside the filter).
exports.updatePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { content, images } = req.body;

    const update = { isEdited: true };
    if (content !== undefined) update.content = content.trim();
    if (images  !== undefined) update.images  = images.slice(0, 5);

    const updated = await Post.findOneAndUpdate(
      { _id: req.params.id, author: userId },   // ownership check baked into filter
      { $set: update },
      { new: true, lean: true }
    );

    if (!updated) {
      // Either post doesn't exist or user isn't the owner — distinguish for UX
      const exists = await Post.exists({ _id: req.params.id });
      return exists
        ? res.status(403).json({ success: false, message: 'Not authorized' })
        : res.status(404).json({ success: false, message: 'Post not found' });
    }

    invalidateFeedCache();
    res.json({ success: true, data: enrichPost(updated, userId) });
  } catch (err) {
    console.error('updatePost error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── DELETE /api/community/posts/:id ──────────────────────────────────────────
exports.deletePost = async (req, res) => {
  try {
    const userId  = req.user.id;
    const isStaff = ['admin', 'teacher'].includes(req.user.role);
    const post    = await Post.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const isOwner = post.author.toString() === userId;
    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await Post.deleteOne({ _id: post._id });
    await Reply.deleteMany({ post: post._id });
    await Notification.deleteMany({ post: post._id });

    invalidateFeedCache();

    // Deduct points only when owner self-deletes
    if (isOwner) {
      getPointValues().then((pts) => awardPoints(userId, -pts.post)).catch(console.error);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('deletePost error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── PUT /api/community/posts/:id/pin ─────────────────────────────────────────
exports.pinPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    post.isPinned = !post.isPinned;
    await post.save();
    invalidateFeedCache(); // pinned status affects sort order in default view
    res.json({ success: true, data: { isPinned: post.isPinned } });
  } catch (err) {
    console.error('pinPost error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── PUT /api/community/posts/:id/save ────────────────────────────────────────
// Atomic toggle. Best case: 1 DB op (when saving). Worst case: 2 DB ops (when
// unsaving). Both ops use indexed filters and atomic $addToSet/$pull — no
// document load, no array serialization, no full-doc rewrite.
exports.savePost = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Try to ADD first. The filter requires the user not already be in savedBy,
    // so this is idempotent and tells us whether we just saved.
    const added = await Post.findOneAndUpdate(
      { _id: req.params.id, savedBy: { $ne: userId } },
      { $addToSet: { savedBy: userId } },
      { projection: { _id: 1 }, lean: true }
    );

    if (added) {
      return res.json({ success: true, data: { isSaved: true } });
    }

    // Either the user already saved this, or the post doesn't exist. Try unsave.
    const removed = await Post.findOneAndUpdate(
      { _id: req.params.id, savedBy: userId },
      { $pull: { savedBy: userId } },
      { projection: { _id: 1 }, lean: true }
    );

    if (!removed) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    res.json({ success: true, data: { isSaved: false } });
  } catch (err) {
    console.error('savePost error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── POST /api/community/posts/:id/vote ───────────────────────────────────────
// Atomic vote: 1 light read for validation + 1 atomic update (no full-doc
// rewrite). For a vote-change (prev vote on a different option), uses bulkWrite
// to combine $pull(prev) + $addToSet(new) in a single round-trip.
exports.votePoll = async (req, res) => {
  try {
    const userId = req.user.id;
    const uid    = new mongoose.Types.ObjectId(userId);
    const { optionIndex } = req.body;

    // Light read — only the fields needed for validation. .lean() avoids the
    // mongoose document overhead since we never call .save() now.
    const post = await Post.findById(req.params.id)
      .select('type poll')
      .lean();
    if (!post || post.type !== 'poll') {
      return res.status(404).json({ success: false, message: 'Poll not found' });
    }

    const opts = post.poll.options || [];
    if (optionIndex < 0 || optionIndex >= opts.length) {
      return res.status(400).json({ success: false, message: 'Invalid option index' });
    }

    // Find previous vote in JS — no DB call.
    let prevVoteIndex = -1;
    for (let i = 0; i < opts.length; i++) {
      if (opts[i].votes?.some((v) => v.toString() === userId)) { prevVoteIndex = i; break; }
    }

    // Quiz mode: cannot change vote after first vote.
    if (prevVoteIndex !== -1 && post.poll.isQuizMode) {
      return res.status(400).json({ success: false, message: 'Cannot change vote in quiz mode' });
    }

    const isToggleOff = prevVoteIndex === optionIndex;

    if (isToggleOff) {
      // Single atomic $pull on the chosen option's votes array.
      await Post.updateOne(
        { _id: req.params.id },
        { $pull: { [`poll.options.${optionIndex}.votes`]: uid } }
      );
    } else {
      // bulkWrite combines pull-from-prev (if any) and add-to-new in one
      // round-trip. Each op is an atomic delta — no full doc serialization.
      const ops = [];
      if (prevVoteIndex !== -1) {
        ops.push({
          updateOne: {
            filter: { _id: req.params.id },
            update: { $pull: { [`poll.options.${prevVoteIndex}.votes`]: uid } },
          },
        });
      }
      ops.push({
        updateOne: {
          filter: { _id: req.params.id },
          update: { $addToSet: { [`poll.options.${optionIndex}.votes`]: uid } },
        },
      });
      await Post.bulkWrite(ops);
    }

    // Compute new state in JS — no second DB read needed since we know exactly
    // what we changed.
    const newOpts = opts.map((o, i) => {
      const oldVotes = o.votes || [];
      let newVotes = oldVotes;
      if (isToggleOff && i === optionIndex) {
        newVotes = oldVotes.filter((v) => v.toString() !== userId);
      } else if (!isToggleOff) {
        if (i === prevVoteIndex) {
          newVotes = oldVotes.filter((v) => v.toString() !== userId);
        } else if (i === optionIndex) {
          newVotes = oldVotes.some((v) => v.toString() === userId) ? oldVotes : [...oldVotes, uid];
        }
      }
      return { ...o, votes: newVotes };
    });

    const totalVotes = newOpts.reduce((s, o) => s + (o.votes?.length || 0), 0);
    const newVoteIdx = newOpts.findIndex((o) => o.votes?.some((v) => v.toString() === userId));
    const hasVoted   = newVoteIdx !== -1;

    res.json({
      success: true,
      data: {
        options:       newOpts.map((o) => ({ _id: o._id, text: o.text, voteCount: o.votes?.length || 0 })),
        totalVotes,
        myVoteIndex:   newVoteIdx,
        isQuizMode:    post.poll.isQuizMode,
        correctOption: (post.poll.isQuizMode && hasVoted) ? post.poll.correctOption : undefined,
        explanation:   (post.poll.isQuizMode && hasVoted) ? post.poll.explanation   : undefined,
      },
    });
  } catch (err) {
    console.error('votePoll error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── GET /api/community/leaderboard ───────────────────────────────────────────
// Reads from the 5-minute leaderboard cache. Auto-refreshes on TTL expiry.
const {
  getLeaderboard,
  getCacheExpiry,
  manualRefreshLeaderboard,
  getBadge,
} = require('../utils/leaderboardCache');

exports.getLeaderboardData = async (req, res) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;

    const leaderboard = await getLeaderboard();   // cached, auto-refresh on TTL

    const me       = await User.findById(userId).select('communityPoints').lean();
    const myPoints = me?.communityPoints || 0;

    // myRank fast path: if the user is in the cached top 10, derive their
    // rank from the cache index — 0 DB ops. Only fall back to countDocuments
    // for students outside the top 10.
    let myRank = null;
    if (role === 'student') {
      const cachedIdx = leaderboard.findIndex((u) => u._id.toString() === userId);
      myRank = cachedIdx !== -1
        ? cachedIdx + 1
        : await User.countDocuments({ role: 'student', communityPoints: { $gt: myPoints } }) + 1;
    }

    res.json({
      success: true,
      data: {
        leaderboard,
        myPoints,
        myRank,
        myBadge:      getBadge(myPoints),
        isStaff:      role !== 'student',
        cacheExpires: getCacheExpiry(),  // ms timestamp — frontend uses to show "next refresh" time
      },
    });
  } catch (err) {
    console.error('getLeaderboardData error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── POST /api/community/leaderboard/refresh ───────────────────────────────────
// Manual cache refresh. Throttled to 30 seconds inside leaderboardCache.js.
// Broadcasts the new leaderboard via SSE so all connected clients update.
exports.refreshLeaderboard = async (req, res) => {
  try {
    const result = await manualRefreshLeaderboard();
    res.json({
      success: true,
      data: {
        leaderboard:  result.leaderboard,
        refreshed:    result.refreshed,
        cacheExpires: result.cacheExpires,
      },
    });
  } catch (err) {
    console.error('refreshLeaderboard error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── GET /api/community/staff-performance (admin only) ─────────────────────────
// 3 DB hits total: 1 User.find + 2 aggregates (run in parallel).
exports.getStaffPerformance = async (req, res) => {
  try {
    const staff = await User.find({ role: { $in: ['teacher', 'admin'] } })
      .select('fullName role profilePicture communityPoints')
      .lean();

    if (staff.length === 0) return res.json({ success: true, data: [] });

    const staffIds = staff.map((s) => s._id);

    const [postStats, replyStats] = await Promise.all([
      Post.aggregate([
        { $match: { author: { $in: staffIds } } },
        { $group: { _id: '$author', postCount: { $sum: 1 } } },
      ]),
      Reply.aggregate([
        { $match: { author: { $in: staffIds } } },
        { $group: {
          _id:            '$author',
          replyCount:     { $sum: 1 },
          helpfulReceived:{ $sum: '$helpfulCount' },
          answersGiven:   { $sum: { $cond: ['$isAnswer', 1, 0] } },
        }},
      ]),
    ]);

    const postMap  = Object.fromEntries(postStats.map((p) => [p._id.toString(), p.postCount]));
    const replyMap = Object.fromEntries(replyStats.map((r) => [r._id.toString(), r]));

    const data = staff
      .map((s) => {
        const id = s._id.toString();
        const rs = replyMap[id] || {};
        return {
          _id:             s._id,
          fullName:        s.fullName,
          role:            s.role,
          profilePicture:  s.profilePicture || null,
          postCount:       postMap[id] || 0,
          replyCount:      rs.replyCount || 0,
          helpfulReceived: rs.helpfulReceived || 0,
          answersGiven:    rs.answersGiven || 0,
        };
      })
      .sort((a, b) => b.replyCount - a.replyCount);

    res.json({ success: true, data });
  } catch (err) {
    console.error('getStaffPerformance error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
