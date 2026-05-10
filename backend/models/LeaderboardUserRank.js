const mongoose = require('mongoose');

// One document per (user × board type × subject).
// Written exclusively by leaderboardJob.js after each recompute.
// Read by leaderboardController.js for personal rank lookup — O(1) indexed read.
const leaderboardUserRankSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:           { type: String, enum: ['alltime', 'weekly', 'monthly', 'mostimproved', 'subject'], required: true },
  subjectTitle:   { type: String, default: null },   // null for global boards
  rank:           { type: Number, required: true },
  score:          { type: Number, default: 0 },
  accuracy:       { type: Number, default: 0 },
  totalAttempted: { type: Number, default: 0 },
  correctCount:   { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },
  delta:          { type: Number, default: null },   // mostimproved only
  computedAt:     { type: Date,   default: Date.now },
}, { _id: true });

// Primary lookup: given userId + board type → O(1)
leaderboardUserRankSchema.index({ userId: 1, type: 1, subjectTitle: 1 }, { unique: true });

module.exports = mongoose.model('LeaderboardUserRank', leaderboardUserRankSchema);
