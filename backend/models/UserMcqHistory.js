const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Tracks each user's interaction history with individual MCQs.
// Updated fire-and-forget after every completeTest call.
// Powers the "Unused / Incorrect / Correct / Omitted / Marked" filter in AutoTestGenerator.
const userMcqHistorySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mcq:  { type: Schema.Types.ObjectId, ref: 'MCQ',  required: true },

  // Copied from MCQ at write-time for efficient scope-filtered aggregations
  questionBankId: { type: Schema.Types.ObjectId, ref: 'QuestionBank' },
  qbSubjectId:    Schema.Types.ObjectId,
  qbChapterId:    Schema.Types.ObjectId,
  qbTopicId:      Schema.Types.ObjectId,

  // Result of the most recent completed attempt for this MCQ
  lastResult: { type: String, enum: ['correct', 'incorrect', 'omitted'], default: 'omitted' },

  totalAttempts:  { type: Number, default: 0 },
  correctCount:   { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },
  omittedCount:   { type: Number, default: 0 },

  // Sticky flags — once set true, not reverted by later attempts
  markedForReview: { type: Boolean, default: false },
  saved:           { type: Boolean, default: false },

  lastAttemptedAt: Date,
});

userMcqHistorySchema.index({ user: 1, mcq: 1 }, { unique: true });
userMcqHistorySchema.index({ user: 1, questionBankId: 1 });
userMcqHistorySchema.index({ user: 1, questionBankId: 1, lastResult: 1 });
userMcqHistorySchema.index({ user: 1, questionBankId: 1, qbTopicId: 1 });
userMcqHistorySchema.index({ user: 1, questionBankId: 1, markedForReview: 1 });

module.exports = mongoose.model('UserMcqHistory', userMcqHistorySchema);
