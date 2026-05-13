const mongoose = require('mongoose');

// ── Per-user per-topic state — the hot collection of the syllabus module ────
// Grows to (active_users × studied_topics). Read whenever a student opens the
// syllabus or Today page; written every time they tap Again/Good/Easy or flip
// a tracker. Every hot path is covered by an index — see the index block.
// ─────────────────────────────────────────────────────────────────────────────
const UserTopicProgressSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',          required: true },
  topic: { type: mongoose.Schema.Types.ObjectId, ref: 'SyllabusTopic', required: true },

  // Lifecycle state for the dashboard rollup counts.
  status: {
    type: String,
    enum: ['new', 'learning', 'reviewing', 'mastered'],
    default: 'new',
    index: false, // covered by the compound index below
  },

  // Leitner scheduling fields. nextReviewDay is a PKT 'YYYY-MM-DD' string so
  // we can compare via string sort against today (works with the index).
  leitnerStage:  { type: Number, default: 0 },
  intervalDays:  { type: Number, default: 0 },
  nextReviewDay: { type: String, default: '' },

  failCount:    { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },

  // 3 per-topic trackers (lecture watched, book read, MCQs practiced).
  lectureDone:   { type: Boolean, default: false },
  lectureDoneAt: { type: Date,    default: null },
  bookDone:      { type: Boolean, default: false },
  bookDoneAt:    { type: Date,    default: null },
  mcqCount:      { type: Number,  default: 0 },
  mcqTarget:     { type: Number,  default: 50 },
  mcqLastAt:     { type: Date,    default: null },

  firstStudiedAt: { type: Date, default: null },
  lastReviewedAt: { type: Date, default: null },
}, { timestamps: true });

// Upsert lookup + "is this topic started?" check.
UserTopicProgressSchema.index({ user: 1, topic: 1 }, { unique: true });
// "Due today" — THE hot index for the Today page.
UserTopicProgressSchema.index({ user: 1, nextReviewDay: 1 });
// Rollup counts (status group-by per user).
UserTopicProgressSchema.index({ user: 1, status: 1 });
// Tracker-gap scan (used by Today reminders + auto-seed-todo).
UserTopicProgressSchema.index({ user: 1, lastReviewedAt: -1 });

module.exports = mongoose.model('UserTopicProgress', UserTopicProgressSchema);
