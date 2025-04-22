// Place this file in: models/Test.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const testSchema = new Schema(
  {
    title: { type: String, required: true },
    description: String,
    session: { type: String, required: true },
    subject: { type: String, required: true },
    unit: { type: String, required: true },
    topic: { type: String, required: true },
    subTopic: String,
    duration: { type: Number, required: true }, // in minutes
    totalQuestions: { type: Number, default: 0 },
    passingScore: { type: Number, default: 50 }, // percentage
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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Test', testSchema);