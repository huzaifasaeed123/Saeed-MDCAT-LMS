const mongoose = require('mongoose');

// ── Syllabus catalog — one row per learning outcome ──────────────────────────
// Global, shared, immutable from a student's perspective. Lives in a small
// (~300–500 row) collection that's safe to keep fully cached in memory and
// invalidate on admin write. Subject + unitTitle are denormalised on every
// topic so a single find() returns the whole tree without joins. Renaming a
// unit is a bulk update across all topics that share (subject, unitNumber).
// ─────────────────────────────────────────────────────────────────────────────
const SyllabusTopicSchema = new mongoose.Schema({
  subject:     { type: String, required: true, trim: true },
  unitNumber:  { type: Number, required: true, min: 1 },
  unitTitle:   { type: String, required: true, trim: true },
  outcomeCode: { type: String, required: true, trim: true }, // e.g. "3.4"
  outcomeText: { type: String, required: true, trim: true },
  sortOrder:   { type: Number, default: 0 },
  // Optional flashcard-deck linkage. Populated when admin links a deck (or by
  // the "relink all" pass once flashcards ship). Nullable today.
  linkedDeck:  { type: mongoose.Schema.Types.ObjectId, ref: 'FlashDeck', default: null },
}, { timestamps: true });

// Primary list query: subject → unit → sort_order → code. Covers the tree
// rendering used by every student dashboard hit (served from cache).
SyllabusTopicSchema.index({ subject: 1, unitNumber: 1, sortOrder: 1, outcomeCode: 1 });
// Unique constraint: no two topics in the same (subject, unitNumber) share a code.
SyllabusTopicSchema.index({ subject: 1, unitNumber: 1, outcomeCode: 1 }, { unique: true });
// Sparse — only present on linked rows; lets us find "all topics tied to this deck".
SyllabusTopicSchema.index({ linkedDeck: 1 }, { sparse: true });

module.exports = mongoose.model('SyllabusTopic', SyllabusTopicSchema);
