const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const savedQuestionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mcq: {
    type: Schema.Types.ObjectId,
    ref: 'MCQ',
    required: true
  },
  notes: {
    type: String
  },
  taggedCategories: [String],
  testId: {
    type: Schema.Types.ObjectId,
    ref: 'Test'
  }
}, { timestamps: true });

// Create a compound index to ensure a user can only save a question once
savedQuestionSchema.index({ user: 1, mcq: 1 }, { unique: true });

module.exports = mongoose.model('SavedQuestion', savedQuestionSchema);