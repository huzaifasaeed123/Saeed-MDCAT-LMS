// Place this file in: models/MCQ.js

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

const statisticsSchema = new Schema(
  {
    optionsSelections: {
      type: Map,
      of: Number,
      default: {},
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
    published: { type: Boolean, default: false },
    referencePdfs: [referencePdfSchema],
    category: String,
    session: String,
    subject: String,
    unit: String,
    topic: String,
    subTopic: String,
    statistics: statisticsSchema,
    testId: { type: Schema.Types.ObjectId, ref: 'Test', required: true }, //Make review for this decesion
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

module.exports = mongoose.model('MCQ', mcqSchema);