const mongoose = require('mongoose');

// ── Per-user sticky notes — pinned reminders shown on the Today view ────────
// Lightweight CRUD collection. Each note can optionally be linked to a
// syllabus topic so it surfaces alongside that topic. Color is constrained so
// the frontend can use a fixed palette.
// ─────────────────────────────────────────────────────────────────────────────
const UserStickyNoteSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:     { type: String, default: '', trim: true, maxlength: 120 },
  body:      { type: String, required: true, trim: true, maxlength: 4000 },
  color:     { type: String, enum: ['yellow', 'pink', 'blue', 'green', 'purple'], default: 'yellow' },
  pinned:    { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
  topic:     { type: mongoose.Schema.Types.ObjectId, ref: 'SyllabusTopic', default: null },
}, { timestamps: true });

// List query: pinned first, then by sortOrder, then by most-recently-updated.
UserStickyNoteSchema.index({ user: 1, pinned: -1, sortOrder: 1, updatedAt: -1 });

module.exports = mongoose.model('UserStickyNote', UserStickyNoteSchema);
