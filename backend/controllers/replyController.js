const mongoose     = require('mongoose');
const Reply        = require('../models/Reply');
const Post         = require('../models/Post');
const User         = require('../models/User');
const Notification = require('../models/Notification');
const { pushToUser } = require('../utils/sseManager');
const { awardPoints, getPointValues } = require('../utils/pointsService');

// Build display-ready author from snapshot (no populate needed).
// communityPoints is intentionally excluded — replies don't show badges.
const buildAuthor = (reply) => ({
  _id: reply.author,
  ...(reply.authorSnapshot || {}),
});

const enrichReply = (reply, userId) => {
  const r = { ...reply };
  r.author    = buildAuthor(reply);
  r.isHelpful = (reply.helpfulVotes || []).some((v) => v.toString() === userId);
  delete r.authorSnapshot;
  delete r.helpfulVotes; // strip raw voter list from response
  return r;
};

// ── GET /api/community/posts/:id/replies?page=N ───────────────────────────────
// Paginated 5 per page. limit+1 hasMore pattern, no countDocuments.
// 1 DB op total (no populate — authorSnapshot is embedded).
exports.getReplies = async (req, res) => {
  try {
    const userId = req.user.id;
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = 5;
    const skip   = (page - 1) * limit;

    const raw = await Reply.find({ post: req.params.id })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit + 1)
      .lean();

    const hasMore = raw.length > limit;
    const data    = (hasMore ? raw.slice(0, limit) : raw).map((r) => enrichReply(r, userId));

    res.json({ success: true, data, hasMore, page });
  } catch (err) {
    console.error('getReplies error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── POST /api/community/posts/:id/replies ─────────────────────────────────────
// 2 blocking DB ops (down from 3 — no second findById to populate).
exports.createReply = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;
    const { content, images = [] } = req.body;

    if (!content?.trim() && images.length === 0) {
      return res.status(400).json({ success: false, message: 'Reply must have content or an image' });
    }

    // Run both light reads in parallel: post.author for notification target,
    // and the user's current communityPoints for the snapshot.
    const [post, me] = await Promise.all([
      Post.findById(postId).select('author').lean(),
      User.findById(userId).select('communityPoints').lean(),
    ]);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const authorSnapshot = {
      fullName:        req.user.fullName,
      role:            req.user.role,
      profilePicture:  req.user.profilePicture || null,
      communityPoints: me?.communityPoints || 0,
    };

    const reply = await Reply.create({
      post: postId,
      author: userId,
      authorSnapshot,
      content: content?.trim() || '',
      images:  images.slice(0, 5),
    });

    // Increment reply count on post (fire-and-forget).
    Post.updateOne({ _id: postId }, { $inc: { replyCount: 1 } }).catch(console.error);

    // Dashboard cache is NOT invalidated here. The 3-min SWR fresh window
    // handles freshness without forcing a rebuild on every reply.

    // Award reply points + capture the value for the response toast.
    const pts = await getPointValues();   // cached, no DB call
    awardPoints(userId, pts.reply);       // fire-and-forget

    // Notify post author (skip if replying to own post). Each reply is unique
    // so we don't collapse — one notification per reply.
    const postAuthorId = post.author.toString();
    if (postAuthorId !== userId) {
      const snippet = (content || '').substring(0, 100);
      Notification.create({
        recipient: postAuthorId,
        type:      'reply',
        actor:     userId,
        actorName: req.user.fullName,
        post:      postId,
        reply:     reply._id,
        snippet,
      }).then((notif) => {
        // Push the full notification body so the frontend can render it
        // directly without an API refetch on bell open.
        pushToUser(postAuthorId, 'notification', { notification: notif.toObject() });
      }).catch(console.error);
    }

    // Build response from the freshly created document — no second DB read.
    res.status(201).json({
      success: true,
      data: enrichReply(reply.toObject(), userId),
      pointsEarned: pts.reply,
    });
  } catch (err) {
    console.error('createReply error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── PUT /api/community/replies/:id ────────────────────────────────────────────
// Single DB op via findOneAndUpdate (ownership check in filter).
exports.updateReply = async (req, res) => {
  try {
    const userId = req.user.id;
    const { content, images } = req.body;

    const update = { isEdited: true };
    if (content !== undefined) update.content = content.trim();
    if (images  !== undefined) update.images  = images.slice(0, 5);

    const updated = await Reply.findOneAndUpdate(
      { _id: req.params.id, author: userId },
      { $set: update },
      { new: true, lean: true }
    );

    if (!updated) {
      const exists = await Reply.exists({ _id: req.params.id });
      return exists
        ? res.status(403).json({ success: false, message: 'Not authorized' })
        : res.status(404).json({ success: false, message: 'Reply not found' });
    }

    res.json({ success: true, data: enrichReply(updated, userId) });
  } catch (err) {
    console.error('updateReply error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── DELETE /api/community/replies/:id ─────────────────────────────────────────
// Cascades (notification deletion, replyCount decrement) are fire-and-forget.
// User gets an instant response; cleanup follows asynchronously.
exports.deleteReply = async (req, res) => {
  try {
    const userId  = req.user.id;
    const isStaff = ['admin', 'teacher'].includes(req.user.role);

    // Find + ownership check + delete in two ops (we need the doc to know post + isAnswer + author).
    const reply = await Reply.findById(req.params.id).lean();
    if (!reply) return res.status(404).json({ success: false, message: 'Reply not found' });

    const isOwner = reply.author.toString() === userId;
    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await Reply.deleteOne({ _id: reply._id });

    // Everything below is fire-and-forget — response goes out immediately.
    Notification.deleteMany({ reply: reply._id }).catch(console.error);
    Post.updateOne({ _id: reply.post }, { $inc: { replyCount: -1 } }).catch(console.error);

    if (reply.isAnswer) {
      Reply.exists({ post: reply.post, isAnswer: true }).then((stillHas) => {
        if (!stillHas) Post.updateOne({ _id: reply.post }, { isAnswered: false }).catch(console.error);
      }).catch(console.error);
    }

    if (isOwner) {
      getPointValues().then((pts) => awardPoints(userId, -pts.reply)).catch(console.error);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('deleteReply error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── PUT /api/community/replies/:id/answer ─────────────────────────────────────
// Admin / teacher only — toggles the "Best Answer" tag on a reply.
exports.markAnswer = async (req, res) => {
  try {
    const reply    = await Reply.findById(req.params.id);
    if (!reply) return res.status(404).json({ success: false, message: 'Reply not found' });

    const wasAnswer  = reply.isAnswer;
    reply.isAnswer   = !wasAnswer;
    await reply.save();

    const pts = await getPointValues();   // cached, returned to the response

    if (!wasAnswer) {
      // Marking as answer — award points and notify
      Post.updateOne({ _id: reply.post }, { isAnswered: true }).catch(console.error);

      awardPoints(reply.author, pts.answer);   // fire-and-forget

      const replyAuthorId = reply.author.toString();
      Notification.create({
        recipient: replyAuthorId,
        type:      'answer',
        actor:     req.user.id,
        actorName: req.user.fullName,
        post:      reply.post,
        reply:     reply._id,
      }).then((notif) => {
        pushToUser(replyAuthorId, 'notification', { notification: notif.toObject() });
      }).catch(console.error);
    } else {
      // Unmarking — deduct answer points (floors at 0 via pointsService)
      awardPoints(reply.author, -pts.answer);   // fire-and-forget

      Reply.exists({ post: reply.post, isAnswer: true }).then((stillHas) => {
        if (!stillHas) Post.updateOne({ _id: reply.post }, { isAnswered: false }).catch(console.error);
      }).catch(console.error);
    }

    res.json({
      success: true,
      data: { isAnswer: reply.isAnswer },
      pointsEarned: !wasAnswer ? pts.answer : -pts.answer,
    });
  } catch (err) {
    console.error('markAnswer error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── PUT /api/community/replies/:id/helpful ────────────────────────────────────
// Single DB op for the toggle, plus an upfront read to detect own-reply + cap.
// Compared to the old 2-op findById+save: now uses findOneAndUpdate with $addToSet
// and $inc — atomic, no full-document rewrite, no array re-serialization on save.
exports.toggleHelpful = async (req, res) => {
  try {
    const userId = req.user.id;
    const uid    = new mongoose.Types.ObjectId(userId);

    // Light read: only what we need for the rules (no populate, projected fields).
    const reply = await Reply.findById(req.params.id).select('author helpfulVotes helpfulCount post').lean();
    if (!reply) return res.status(404).json({ success: false, message: 'Reply not found' });

    if (reply.author.toString() === userId) {
      return res.status(400).json({ success: false, message: 'Cannot mark own reply as helpful' });
    }

    const alreadyVoted = (reply.helpfulVotes || []).some((v) => v.toString() === userId);

    let updated;
    if (alreadyVoted) {
      // Remove vote, decrement counter (atomic, single op).
      updated = await Reply.findOneAndUpdate(
        { _id: reply._id },
        { $pull: { helpfulVotes: uid }, $inc: { helpfulCount: -1 } },
        { new: true, lean: true, projection: { helpfulCount: 1 } }
      );
    } else {
      // Add vote, increment counter (atomic, single op). $addToSet prevents duplicates.
      updated = await Reply.findOneAndUpdate(
        { _id: reply._id, helpfulVotes: { $ne: uid } },
        { $addToSet: { helpfulVotes: uid }, $inc: { helpfulCount: 1 } },
        { new: true, lean: true, projection: { helpfulCount: 1 } }
      );

      // Side effects only on first vote, capped at 10 helpful for points.
      if ((reply.helpfulVotes || []).length < 10) {
        getPointValues().then((pts) => awardPoints(reply.author, pts.helpful)).catch(console.error);

        // Collapse: if there's already an unread `helpful` notification for
        // this reply, $inc count + bump createdAt to the top + update actor.
        // Otherwise insert a new one. Done in a single atomic upsert.
        const replyAuthorId = reply.author.toString();
        Notification.findOneAndUpdate(
          { recipient: replyAuthorId, type: 'helpful', reply: reply._id, isRead: false },
          {
            $set: {
              actor:     userId,
              actorName: req.user.fullName,
              post:      reply.post,
              createdAt: new Date(),
            },
            $inc: { count: 1 },
          },
          { upsert: true, new: true, lean: true, setDefaultsOnInsert: true }
        ).then((notif) => {
          if (!notif) return;
          pushToUser(replyAuthorId, 'notification', { notification: notif });
        }).catch(console.error);
      }
    }

    // Floor counter at 0 just in case it went negative on an out-of-order delete
    const helpfulCount = Math.max(0, updated?.helpfulCount ?? 0);

    res.json({ success: true, data: { helpfulCount, isHelpful: !alreadyVoted } });
  } catch (err) {
    console.error('toggleHelpful error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
