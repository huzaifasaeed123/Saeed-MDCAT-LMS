// backend/models/CourseProgress.js
//
// One row per (user, course). Tracks:
//   • completedResourceIds — resources the user MANUALLY marked complete
//     (videos / notes / external). Test completions are derived from
//     UserTestAttempt at read time, NOT stored here, so the test attempt
//     collection remains the single source of truth for test progress.
//   • lastResourceId / lastViewedAt — used by "Continue Learning" + the
//     dashboard's last-watched widget.
//
// Sparse — only created when the user actually marks something or opens
// the player. Absence of a row implies a fresh, untouched course.

const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const courseProgressSchema = new Schema(
  {
    user:                 { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    course:               { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    // $addToSet on this when user clicks "Mark complete", $pull on unmark.
    // Orphan IDs (resources the admin later removed) are filtered out at
    // read time — no cleanup job needed.
    completedResourceIds: [{ type: Schema.Types.ObjectId }],
    lastResourceId:       { type: Schema.Types.ObjectId, default: null },
    lastViewedAt:         { type: Date, default: null },
  },
  { timestamps: true },
);

// One row per user-course pair. Used by $addToSet upserts so concurrent
// marks don't race.
courseProgressSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('CourseProgress', courseProgressSchema);
