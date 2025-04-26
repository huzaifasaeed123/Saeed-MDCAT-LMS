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
    enum: ['A', 'B', 'C', 'D', 'E', null], // Option letter, null if not answered
    default: null
  },
  isCorrect: {
    type: Boolean,
    default: false
  },
  timeSpent: { // Time spent on this particular question in seconds
    type: Number,
    default: 0
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
  scorePercentage: {
    type: Number
  },
  questionAttempts: [questionAttemptSchema]
}, { timestamps: true });

// Calculate score before saving
userTestAttemptSchema.pre('save', function(next) {
  if (this.isModified('questionAttempts')) {
    const correctAnswers = this.questionAttempts.filter(attempt => attempt.isCorrect).length;
    this.score = correctAnswers;
    this.maxScore = this.questionAttempts.length;
    this.scorePercentage = this.maxScore > 0 ? (correctAnswers / this.maxScore) * 100 : 0;
  }
  next();
});

module.exports = mongoose.model('UserTestAttempt', userTestAttemptSchema);