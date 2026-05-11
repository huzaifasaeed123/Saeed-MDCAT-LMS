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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Test', testSchema);