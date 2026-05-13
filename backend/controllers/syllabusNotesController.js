const UserStickyNote = require('../models/UserStickyNote');
const treeCache      = require('../utils/syllabusTreeCache');
const todayCache     = require('../utils/syllabusTodayCache');

const NOTE_COLORS = new Set(['yellow', 'pink', 'blue', 'green', 'purple']);

// ─── GET /api/syllabus/me/notes ──────────────────────────────────────────────
// Pinned first, then sortOrder ascending, then most recently updated.
exports.listNotes = async (req, res) => {
  try {
    const rows = await UserStickyNote.find({ user: req.user.id })
      .sort({ pinned: -1, sortOrder: 1, updatedAt: -1 })
      .lean();

    const enriched = await Promise.all(rows.map(async (r) => {
      if (!r.topic) return r;
      const t = await treeCache.getTopicById(r.topic);
      return t ? { ...r,
        subject: t.subject, unitNumber: t.unitNumber, unitTitle: t.unitTitle,
        outcomeCode: t.outcomeCode, outcomeText: t.outcomeText,
      } : r;
    }));

    res.json({ success: true, total: enriched.length, data: enriched });
  } catch (err) {
    console.error('listNotes error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── POST /api/syllabus/me/notes ─────────────────────────────────────────────
exports.createNote = async (req, res) => {
  try {
    const b = req.body || {};
    const body = String(b.body || '').trim();
    if (!body)                return res.status(400).json({ success: false, message: 'body is required' });
    if (body.length > 4000)   return res.status(400).json({ success: false, message: 'body too long (max 4000)' });
    const title = String(b.title || '').trim().slice(0, 120);
    const color = NOTE_COLORS.has(b.color) ? b.color : 'yellow';
    const pinned = !!b.pinned;
    const topic = b.topic || null;
    if (topic) {
      const t = await treeCache.getTopicById(topic);
      if (!t) return res.status(400).json({ success: false, message: 'unknown topic' });
    }

    const last = await UserStickyNote.findOne({ user: req.user.id })
      .sort({ sortOrder: -1 }).select('sortOrder').lean();
    const sortOrder = last ? (last.sortOrder + 1) : 0;

    const doc = await UserStickyNote.create({
      user: req.user.id, title, body, color, pinned, topic, sortOrder,
    });
    todayCache.invalidateUser(req.user.id);
    res.status(201).json({ success: true, data: doc.toObject() });
  } catch (err) {
    console.error('createNote error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── PATCH /api/syllabus/me/notes/:id ───────────────────────────────────────
exports.updateNote = async (req, res) => {
  try {
    const b = req.body || {};
    const update = {};
    if (typeof b.title === 'string') update.title = b.title.trim().slice(0, 120);
    if (typeof b.body === 'string') {
      const body = b.body.trim();
      if (!body) return res.status(400).json({ success: false, message: 'body cannot be empty' });
      if (body.length > 4000) return res.status(400).json({ success: false, message: 'body too long' });
      update.body = body;
    }
    if (typeof b.color === 'string' && NOTE_COLORS.has(b.color)) update.color = b.color;
    if (b.pinned !== undefined) update.pinned = !!b.pinned;
    if (b.sortOrder !== undefined) {
      const n = parseInt(b.sortOrder, 10);
      if (Number.isFinite(n)) update.sortOrder = n;
    }
    if (b.topic !== undefined) {
      const topic = b.topic || null;
      if (topic) {
        const t = await treeCache.getTopicById(topic);
        if (!t) return res.status(400).json({ success: false, message: 'unknown topic' });
      }
      update.topic = topic;
    }
    if (Object.keys(update).length === 0) return res.json({ success: true, unchanged: true });

    const doc = await UserStickyNote.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: update },
      { new: true, lean: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Note not found' });

    todayCache.invalidateUser(req.user.id);
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('updateNote error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── DELETE /api/syllabus/me/notes/:id ──────────────────────────────────────
exports.deleteNote = async (req, res) => {
  try {
    const doc = await UserStickyNote.findOneAndDelete({ _id: req.params.id, user: req.user.id }).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Note not found' });
    todayCache.invalidateUser(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteNote error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
