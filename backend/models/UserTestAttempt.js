const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define schema for individual question attempts within a test
const questionAttemptSchema = new Schema({
  mcqId: {
    type: Schema.Types.ObjectId,
    ref: 'MCQ',
    required: true
  },
  selectedOption: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'E', null],
    default: null
  },
  // Stored at attempt-creation time so frontend can validate answers locally
  correctOption: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'E', null],
    default: null
  },
  isCorrect: {
    type: Boolean,
    default: false
  },
  reported: {
    type: Boolean,
    default: false
  },
  reportReason: {
    type: String
  },
  saved: {
    type: Boolean,
    default: false
  },
  markedForReview: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Main schema for user test attempts
const userTestAttemptSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  test: {
    type: Schema.Types.ObjectId,
    ref: 'Test',
    required: true
  },

  // ── Test snapshot fields ──────────────────────────────────────────────────
  // Denormalised at attempt-creation time (in startTest) so the History
  // endpoint can render a row without populating Test or QuestionBank. The
  // History endpoint went from 8-12 DB queries to 1-2 because of this.
  //
  // These are SNAPSHOTS — if an admin later renames the test or its QB,
  // historical attempts still show the original name (correct UX: "what
  // was this test called when I took it?"). For NEW attempts the latest
  // names are captured.
  //
  // Existing attempts written before this field was added are backfilled
  // by scripts/backfill-user-test-attempt-snapshots.js.
  testTitle:         { type: String, default: '' },
  testSubjects:      { type: [String], default: [] },
  testChapters:      { type: [String], default: [] },
  testTopics:        { type: [String], default: [] },
  questionBankId:    { type: Schema.Types.ObjectId, ref: 'QuestionBank', default: null },
  questionBankTitle: { type: String, default: '' },
  totalQuestions:    { type: Number, default: 0 },

  // Review-unlock snapshot. Captured at startTest time so the History page
  // and any other attempt-list view can gate the "Review answers" button
  // without joining back to Test for every row.
  //
  // testReviewUnlockAt — null = review immediately available; a UTC Date
  //   means "review locked until then". Resolved frontend-side against
  //   `Date.now()` plus the user's identity (creators bypass).
  // testCreatorId — the Test.createdBy at attempt-start. Lets the frontend
  //   recognise the test creator (who always bypasses the lock) without
  //   re-fetching the Test doc.
  //
  // Legacy attempts written before these fields were added will read as
  // null / undefined — which the frontend treats as "review always
  // available", matching the pre-feature behaviour. The optional
  // backfill script can populate them for historical accuracy.
  testReviewUnlockAt: { type: Date, default: null },
  testCreatorId:      { type: Schema.Types.ObjectId, ref: 'User', default: null },

  mode: {
    type: String,
    enum: ['tutor', 'timer'],
    required: true
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'abandoned'],
    default: 'in-progress'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  totalTimeSpent: { // Total time spent in seconds
    type: Number,
    default: 0
  },
  totalDurationSec: { // Full timer duration in seconds (timer mode only; stored at start so resume restores correct remaining time)
    type: Number,
    default: null,
  },
  currentQuestionIndex: {
    type: Number,
    default: 0
  },
  score: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number
  },
  answeredCount: {        // questions where selectedOption !== null (skipped excluded)
    type: Number,
    default: 0
  },
  scorePercentage: {
    type: Number
  },
  questionAttempts: [questionAttemptSchema]
}, { timestamps: true });

// Fast lookup of a user's in-progress attempt for a given test
userTestAttemptSchema.index({ user: 1, test: 1, status: 1 });
// Leaderboard recompute: date-filtered scans across all completed attempts
userTestAttemptSchema.index({ status: 1, createdAt: -1 });
// Per-user personal stats fallback (users outside top 50)
userTestAttemptSchema.index({ user: 1, status: 1, createdAt: -1 });
// Admin/teacher Test-Stats page: aggregates all attempts of one test by status.
// Cold path (admin tooling) but cheap to add and turns a coll-scan into an
// index range scan for very-popular tests with tens of thousands of attempts.
userTestAttemptSchema.index({ test: 1, status: 1 });

// History endpoint filter indexes — these support the post-denormalisation
// filter paths in getUserTestHistory (subject / chapter / topic / qb dropdowns).
// Compound with `user` because every filter is always scoped to the current user.
userTestAttemptSchema.index({ user: 1, testSubjects: 1 });
userTestAttemptSchema.index({ user: 1, testChapters: 1 });
userTestAttemptSchema.index({ user: 1, testTopics: 1 });
userTestAttemptSchema.index({ user: 1, questionBankId: 1 });

module.exports = mongoose.model('UserTestAttempt', userTestAttemptSchema);