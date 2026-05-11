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

module.exports = mongoose.model('UserTestAttempt', userTestAttemptSchema);