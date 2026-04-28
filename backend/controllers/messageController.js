const mongoose                 = require('mongoose');
const Conversation             = require('../models/Conversation');
const Message                  = require('../models/Message');
const User                     = require('../models/User');
const { pushToUser, pushToUsers } = require('../utils/sseManager');

// Reads unread count for one userId from either a Mongoose Map (live doc)
// or a plain object (lean doc). Centralises the access pattern.
const getUnread = (unreadCounts, userId) => {
  if (!unreadCounts) return 0;
  if (typeof unreadCounts.get === 'function') return unreadCounts.get(userId) || 0;
  return unreadCounts[userId] || 0;
};

// ─── GET /api/messages/conversations?page=1&limit=20 ─────────────────────────
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const skip   = (page - 1) * limit;

    // Fetch one extra row — if we get limit+1 back there is another page.
    // This replaces the second countDocuments() call entirely.
    const raw = await Conversation.find({ participants: userId })
      .populate('participants', 'fullName email role profilePicture')
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .lean();

    const hasMore = raw.length > limit;
    const page_data = hasMore ? raw.slice(0, limit) : raw;

    const result = page_data.map((conv) => {
      const other = conv.participants.find((p) => p._id.toString() !== userId);
      return {
        ...conv,
        otherParticipant: other,
        unreadCount: conv.unreadCounts?.[userId] || 0,
      };
    });

    res.json({
      success: true,
      data: result,
      hasMore,
      page,
    });
  } catch (err) {
    console.error('getConversations error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── POST /api/messages/conversations ────────────────────────────────────────
// Find or create a 1-on-1 conversation.
// Students can only start conversations with admins or teachers.
exports.startConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ success: false, message: 'participantId is required' });
    }
    if (participantId === userId) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }

    // Widen select to include display fields — same 1 DB read, no extra cost.
    const target = await User.findById(participantId).select('fullName email role profilePicture').lean();
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    if (req.user.role === 'student' && !['admin', 'teacher'].includes(target.role)) {
      return res.status(403).json({ success: false, message: 'Students can only message admins and teachers' });
    }

    const existing = await Conversation.findOne({
      participants: { $all: [userId, participantId], $size: 2 },
    }).populate('participants', 'fullName email role profilePicture').lean();

    if (existing) {
      const other = existing.participants.find((p) => p._id.toString() !== userId);
      return res.json({
        success: true,
        data: { ...existing, otherParticipant: other, unreadCount: existing.unreadCounts?.[userId] || 0 },
      });
    }

    // New conversation — build response from data already in memory.
    // No extra findById().populate() needed.
    const newConv = await Conversation.create({ participants: [userId, participantId] });
    const otherParticipant = {
      _id:            target._id,
      fullName:       target.fullName,
      email:          target.email,
      role:           target.role,
      profilePicture: target.profilePicture || null,
    };
    res.json({
      success: true,
      data: {
        _id:             newConv._id,
        participants:    [{ _id: userId }, otherParticipant],
        otherParticipant,
        unreadCount:     0,
        lastMessage:     '',
        lastMessageAt:   newConv.createdAt,
        lastMessageBy:   null,
        createdAt:       newConv.createdAt,
        updatedAt:       newConv.updatedAt,
      },
    });
  } catch (err) {
    console.error('startConversation error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── GET /api/messages/conversations/:id/messages ─────────────────────────────
// DB OP 1: findOneAndUpdate — participant check + mark-as-read atomically.
//          new:false returns the BEFORE doc so we know prevUnread for SSE.
// DB OP 2: Message.find with limit+1 — eliminates the countDocuments call.
exports.getMessages = async (req, res) => {
  try {
    const userId         = req.user.id;
    const conversationId = req.params.id;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip  = (page - 1) * limit;

    // DB OP 1 — verify participant AND mark as read in a single atomic write.
    // Using a static key ($set with known userId) — works on all MongoDB versions.
    const prevConv = await Conversation.findOneAndUpdate(
      { _id: conversationId, participants: userId },
      { $set: { [`unreadCounts.${userId}`]: 0 } },
      { new: false, select: 'unreadCounts' }
    ).lean();

    if (!prevConv) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // DB OP 2 — fetch limit+1 rows; the extra row tells us whether more pages exist
    // without a separate countDocuments() call.
    const raw = await Message.find({ conversationId })
      .populate('sender', 'fullName role profilePicture')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit + 1)
      .lean();

    const hasMore  = raw.length > limit;
    const messages = hasMore ? raw.slice(0, limit) : raw;

    // Push badge-decrement SSE back to this same user (zero DB hit)
    const prevUnread = getUnread(prevConv.unreadCounts, userId);
    if (prevUnread > 0) {
      pushToUser(userId, 'messages_read', { conversationId, decrementBy: prevUnread });
    }

    res.json({ success: true, data: messages, hasMore, page });
  } catch (err) {
    console.error('getMessages error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── POST /api/messages/conversations/:id/messages ────────────────────────────
// DB OP 1: Message.create — save the message.
// DB OP 2: Conversation.findOneAndUpdate — participant check (in filter) +
//          set lastMessage fields in one atomic write. new:false returns the
//          BEFORE doc so we can extract otherId and compute newUnread in memory.
// BACKGROUND (not awaited): Conversation.updateOne $inc for recipient unread.
//   Not in the critical path — response and SSE are already sent. Completes
//   in <1ms. Acceptable eventual-consistency for a counter field.
// Response built from msg + req.user — no findById().populate() needed.
// profilePicture is in the JWT payload (added to getSignedAccessToken).
exports.sendMessage = async (req, res) => {
  try {
    const userId         = req.user.id;
    const conversationId = req.params.id;
    const trimmed        = req.body.content?.trim();

    if (!trimmed) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    // DB OP 1
    const msg = await Message.create({ conversationId, sender: userId, content: trimmed });

    // DB OP 2 — participant check (filter) + set lastMessage atomically
    const prevConv = await Conversation.findOneAndUpdate(
      { _id: conversationId, participants: userId },
      {
        $set: {
          lastMessage:   trimmed.substring(0, 100),
          lastMessageAt: msg.createdAt,
          lastMessageBy: userId,
        },
      },
      { new: false, select: 'participants unreadCounts' }
    ).lean();

    if (!prevConv) {
      // Participant check failed — orphaned message cleanup (fire-and-forget)
      Message.deleteOne({ _id: msg._id }).catch(() => {});
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Derive otherId and new unread count entirely in memory (no extra DB read)
    const otherId   = prevConv.participants.find((p) => p.toString() !== userId).toString();
    const oldUnread = getUnread(prevConv.unreadCounts, otherId);
    const newUnread = oldUnread + 1;

    // BACKGROUND — not awaited, not in the response critical path
    Conversation.updateOne(
      { _id: conversationId },
      { $inc: { [`unreadCounts.${otherId}`]: 1 } }
    ).catch((e) => console.error('[sendMessage] unread inc:', e));

    // Build response without a DB re-read
    const responseMsg = {
      _id:            msg._id,
      conversationId: msg.conversationId,
      sender: {
        _id:            userId,
        fullName:       req.user.fullName,
        role:           req.user.role,
        profilePicture: req.user.profilePicture,
      },
      content:   msg.content,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    };

    // Push to recipient via SSE — zero DB hit
    pushToUser(otherId, 'new_message', {
      message: responseMsg,
      conversationId: conversationId.toString(),
      conversationUpdate: {
        lastMessage:   trimmed.substring(0, 100),
        lastMessageAt: msg.createdAt.toISOString(),
        lastMessageBy: userId,
        unreadCount:   newUnread,
      },
    });

    res.status(201).json({ success: true, data: responseMsg });
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── GET /api/messages/users ──────────────────────────────────────────────────
// Student: auto-loads all admins + teachers.
// Admin/Teacher: search by name/email (min 2 chars), max 20 results.
exports.searchUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { q }  = req.query;
    const filter = { _id: { $ne: userId } };

    if (req.user.role === 'student') {
      filter.role = { $in: ['admin', 'teacher'] };
    } else {
      if (!q || q.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
      }
      filter.$or = [
        { fullName: { $regex: q.trim(), $options: 'i' } },
        { email:    { $regex: q.trim(), $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('fullName email role profilePicture')
      .limit(req.user.role === 'student' ? 0 : 20)
      .lean();

    res.json({ success: true, data: users });
  } catch (err) {
    console.error('searchUsers error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


// ─── POST /api/messages/broadcast ────────────────────────────────────────────
// Admin only. Sends a regular message to every student's conversation with this
// admin. Responds immediately; processing runs in the background in batches.
exports.createBroadcast = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Broadcast content is required' });
    }

    const recipientCount = await User.countDocuments({ role: 'student' });

    res.status(202).json({
      success: true,
      message: `Broadcast is being delivered to ${recipientCount} students. It will appear in their conversations shortly.`,
    });

    // Fire-and-forget — do NOT await
    processBroadcast(req.user.id, content.trim()).catch((err) =>
      console.error('[broadcast] background error:', err)
    );
  } catch (err) {
    console.error('createBroadcast error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── Background broadcast processor ─────────────────────────────────────────
// Creates/finds conversations then inserts messages in batches via insertMany
// and bulkWrite — far more efficient than N sequential operations.
const BATCH = 200;

async function processBroadcast(adminId, content) {
  const now = new Date();
  const preview = content.substring(0, 100);

  const students = await User.find({ role: 'student' }).select('_id').lean();
  if (!students.length) return;

  // Find all existing conversations between this admin and any student
  const allAdminConvs = await Conversation.find({ participants: adminId })
    .select('participants')
    .lean();

  const studentIdSet = new Set(students.map((s) => s._id.toString()));
  const studentToConv = {};

  allAdminConvs.forEach((c) => {
    const otherId = c.participants.find((p) => p.toString() !== adminId.toString())?.toString();
    if (otherId && studentIdSet.has(otherId)) {
      studentToConv[otherId] = c._id;
    }
  });

  // Create conversations for students who don't have one with this admin yet
  const newStudents = students.filter((s) => !studentToConv[s._id.toString()]);
  for (let i = 0; i < newStudents.length; i += BATCH) {
    const batch    = newStudents.slice(i, i + BATCH);
    const inserted = await Conversation.insertMany(
      batch.map((s) => ({ participants: [adminId, s._id] }))
    );
    inserted.forEach((c, idx) => { studentToConv[batch[idx]._id.toString()] = c._id; });
  }

  // Insert messages for all students in batches
  for (let i = 0; i < students.length; i += BATCH) {
    const batch = students.slice(i, i + BATCH);
    await Message.insertMany(
      batch.map((s) => ({
        conversationId: studentToConv[s._id.toString()],
        sender:         adminId,
        content,
        createdAt:      now,
        updatedAt:      now,
      }))
    );
  }

  // Update all conversations: lastMessage + increment receiver's unread count
  for (let i = 0; i < students.length; i += BATCH) {
    const batch = students.slice(i, i + BATCH);
    await Conversation.bulkWrite(
      batch.map((s) => ({
        updateOne: {
          filter: { _id: studentToConv[s._id.toString()] },
          update: {
            $set: { lastMessage: preview, lastMessageAt: now, lastMessageBy: adminId },
            $inc: { [`unreadCounts.${s._id.toString()}`]: 1 },
          },
        },
      }))
    );
  }

  // Push SSE to every student who currently has an open connection.
  // Students who are offline will see the message on next page load via REST.
  const studentIds = students.map((s) => s._id.toString());
  pushToUsers(studentIds, 'new_message', {
    // No 'message' field for broadcast — keeps payload small (10k pushes).
    // Students load the actual message via REST when they open the conversation.
    conversationUpdate: {
      lastMessage:    preview,
      lastMessageAt:  now.toISOString(),
      lastMessageBy:  adminId.toString(),
      unreadCount:    1,
    },
    // conversationId is per-student so we push individually for those online
  });

  // Per-student push for online users only (so we can include their specific conversationId)
  for (const s of students) {
    const sId   = s._id.toString();
    const convId = studentToConv[sId];
    if (convId) {
      pushToUser(sId, 'new_message', {
        conversationId: convId.toString(),
        conversationUpdate: {
          lastMessage:   preview,
          lastMessageAt: now.toISOString(),
          lastMessageBy: adminId.toString(),
          unreadCount:   1,
        },
      });
    }
  }

  console.log(`[broadcast] delivered to ${students.length} students ✓`);
}

// ─── PUT /api/messages/conversations/:id/read ─────────────────────────────────
// Lightweight mark-as-read — used by the frontend when a new SSE message
// arrives while the conversation is already open, so the badge stays at zero.
// Single findOneAndUpdate replaces findOne + conditional save (was 1–2 ops, now always 1).
exports.markConversationRead = async (req, res) => {
  try {
    const userId         = req.user.id;
    const conversationId = req.params.id;

    const prevConv = await Conversation.findOneAndUpdate(
      { _id: conversationId, participants: userId },
      { $set: { [`unreadCounts.${userId}`]: 0 } },
      { new: false, select: 'unreadCounts' }
    ).lean();

    if (!prevConv) return res.status(404).json({ success: false, message: 'Conversation not found' });

    const prevUnread = getUnread(prevConv.unreadCounts, userId);
    if (prevUnread > 0) {
      pushToUser(userId, 'messages_read', { conversationId, decrementBy: prevUnread });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('markConversationRead error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
