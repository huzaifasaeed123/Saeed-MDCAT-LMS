const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String },
  senderRole: { type: String, enum: ['student', 'teacher', 'admin'] },
  text: { type: String, required: true },
}, { timestamps: true });

const mcqReportSchema = new Schema({
  mcq: { type: Schema.Types.ObjectId, ref: 'MCQ', required: true },
  test: { type: Schema.Types.ObjectId, ref: 'Test' },
  attempt: { type: Schema.Types.ObjectId, ref: 'UserTestAttempt' },
  reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: {
    type: String,
    enum: [
      'Question Statement Wrong',
      'Option Wrong',
      'Answer Key is Incorrect',
      'Wrong Explanation',
      'Need Explanation',
    ],
    required: true,
  },
  details: { type: String },
  status: {
    type: String,
    enum: ['open', 'active', 'closed'],
    default: 'open',
  },
  handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  messages: [messageSchema],
  // Student satisfaction feedback after teacher responds
  studentSatisfied: { type: Boolean, default: null },
  closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  closedAt: { type: Date },
  // Denormalized MCQ metadata for fast filtering (no joins needed)
  mcqSubject: { type: String },
  mcqChapter: { type: String },
  mcqTopic: { type: String },
  mcqQuestionBank: { type: String },
  mcqQuestionBankId: { type: Schema.Types.ObjectId, ref: 'QuestionBank' },
}, { timestamps: true });

// Index for common query patterns
mcqReportSchema.index({ reportedBy: 1, status: 1 });
mcqReportSchema.index({ handledBy: 1, status: 1 });
mcqReportSchema.index({ status: 1, createdAt: -1 });
mcqReportSchema.index({ mcqQuestionBankId: 1 });
mcqReportSchema.index({ mcq: 1 });

module.exports = mongoose.model('MCQReport', mcqReportSchema);
