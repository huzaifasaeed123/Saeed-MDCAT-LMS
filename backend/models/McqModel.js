// File: models/McqModel.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const optionSchema = new Schema(
  {
    optionLetter: { type: String, enum: ['A', 'B', 'C', 'D', 'E'], required: true },
    optionText: { type: String, required: true },
    isCorrect: { type: Boolean, default: false },
    explanationText: { type: String },
  },
  { _id: true }
);

const referencePdfSchema = new Schema(
  {
    board: String,
    startPage: Number,
    endPage: Number,
    refId: Schema.Types.ObjectId,
    pdfSelectedText: String,
    isPublished: { type: Boolean, default: false },
    pdfLink: String,
    pdfName: String,
    pdfMetadata: String,
    totalPages: Number,
    subject: String,
    createdBy: String,
    createdAt: Date,
    updatedAt: Date,
  },
  { _id: true }
);

// Explicit numeric fields instead of Mongoose's `Map` type. The Map worked
// for storage ($inc/$set wrote correctly), but when this sub-schema was read
// back via populate, the Map field inside the nested sub-document didn't
// pass through `flattenMaps`, so the frontend received `optionsSelections`
// as `{}` and every option's percentage collapsed (only the just-picked one
// rendered at 100% via the optimistic +1). Plain Number fields serialise
// over JSON without any of that — and the existing `$inc` / `$set` operations
// keep working unchanged because they use dotted paths.
const statisticsSchema = new Schema(
  {
    optionsSelections: {
      A:     { type: Number, default: 0 },
      B:     { type: Number, default: 0 },
      C:     { type: Number, default: 0 },
      D:     { type: Number, default: 0 },
      E:     { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    recommendedDifficulty: {
      type: String,
      enum: ['Very Easy', 'Easy', 'Average', 'Hard', 'Very Hard'],
    },
    correctPercentage: Number,
    expertSolutionVideoLink: String,
    lastUpdated: Date,
  },
  { _id: false }
);

const mcqSchema = new Schema(
  {
    author: { type: String, required: true },
    questionText: { type: String, required: true },
    options: { 
      type: [optionSchema],
      validate: [v => v.length >= 2, 'At least 2 options are required']
    },
    explanationText: String,
    referencePdfs: [referencePdfSchema],
    category: String,
    session: String,
    subject: String,
    unit: String,
    topic: String,
    subTopic: String,
    statistics: statisticsSchema,
    // Primary QB classification (MCQ always belongs to a QB first)
    questionBankId: { type: Schema.Types.ObjectId, ref: 'QuestionBank' },
    qbSubjectId:    { type: Schema.Types.ObjectId },
    qbChapterId:    { type: Schema.Types.ObjectId },
    qbTopicId:      { type: Schema.Types.ObjectId },

    // Optional link to a specific Test (may be null for QB-only MCQs)
    testId: { type: Schema.Types.ObjectId, ref: 'Test' },

    // New fields
    difficulty: { 
      type: String, 
      enum: ['Easy', 'Medium', 'Hard'], 
      default: 'Medium' 
    },
    isPublic: { 
      type: Boolean, 
      default: true 
    },
    revisionCount: { 
      type: Number, 
      default: 0 
    },
    lastRevised: { 
      type: Date
    }
  },
  { timestamps: true }
);

// Ensure only one correct option
mcqSchema.pre('save', function(next) {
  const correctOptions = this.options.filter(opt => opt.isCorrect);
  if (correctOptions.length !== 1) {
    next(new Error('Exactly one option must be marked as correct'));
  } else {
    next();
  }
});

mcqSchema.index({ testId: 1 });
mcqSchema.index({ questionBankId: 1, qbTopicId: 1 });

module.exports = mongoose.model('MCQ', mcqSchema);