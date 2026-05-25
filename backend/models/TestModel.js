// Place this file in: models/Test.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const testSchema = new Schema(
  {
    title: { type: String, required: true },
    description: String,
    totalQuestions: { type: Number, default: 0 },
    passingScore: { type: Number, default: 50 }, // percentage
    // Max number of times a student is allowed to take this test.
    // null = unlimited (the default). Enforced only for role === 'student'
    // in userTestController.startTest. An in-progress attempt does NOT count
    // against the limit — it's a resume of an already-counted attempt.
    maxAttempts: { type: Number, default: null, min: 1 },
    isPublished: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { 
      type: String, 
      enum: ['draft', 'published', 'archived'],
      default: 'draft'
    },
    difficultyLevel: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium'
    },
    instructions: String,
    mcqs: [{ type: Schema.Types.ObjectId, ref: 'MCQ' }],

    // Which test modes are allowed for this test.
    //   ['tutor', 'timer']  → student picks at start (default behaviour)
    //   ['tutor']           → locked to tutor — picker hidden
    //   ['timer']           → locked to timer — picker hidden, only the
    //                          time-multiplier sub-picker remains visible
    // Set by the creator: student auto-tests lock to whichever mode they
    // picked on the Create page; staff can permit one or both.
    allowedModes: {
      type: [String],
      enum: ['tutor', 'timer'],
      default: ['tutor', 'timer'],
    },

    // Question Bank linkage (optional — set when test is QB-linked)
    questionBankId: { type: Schema.Types.ObjectId, ref: 'QuestionBank' },
    qbSubjectId:    { type: Schema.Types.ObjectId },
    qbChapterId:    { type: Schema.Types.ObjectId },
    qbTopicId:      { type: Schema.Types.ObjectId },

    // Auto-populated from MCQs when they are added/removed
    subjects: [{ type: String }],
    chapters: [{ type: String }],
    topics:   [{ type: String }],

    // Optional course linkage
    courseId: { type: Schema.Types.ObjectId, ref: 'Course' },

    // ── Availability scheduling ──────────────────────────────────────────
    // Mirrors the same pattern used on course resources so the frontend
    // can resolve status with the SAME helper for both.
    //   'public'      → always open (default)
    //   'unlock_date' → opens at unlockAt, no close
    //   'window'      → opens at unlockAt, closes at lockAt
    // All dates are stored UTC; admins set them in PKT via the form.
    availability: {
      type: String,
      enum: ['public', 'unlock_date', 'window'],
      default: 'public',
    },
    unlockAt: { type: Date, default: null },
    lockAt:   { type: Date, default: null },

    // ── Review unlock ────────────────────────────────────────────────────
    // Absolute date (PKT, stored UTC) after which the "Review answers"
    // button becomes active for any completed attempt. null = always
    // available immediately after a student submits. Display + gating
    // happens 100% on the frontend from this field; no extra API needed.
    reviewUnlockAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Test', testSchema);