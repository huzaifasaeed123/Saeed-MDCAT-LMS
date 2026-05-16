const mongoose = require('mongoose');

// One document per leaderboard type (+ subjectTitle for subject boards).
// Stores pre-ranked top-50 entries with denormalized user display info.
// Written by the background job every 10 minutes; never written during user requests.
const entrySchema = new mongoose.Schema({
  rank:           { type: Number, required: true },
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fullName:       { type: String, required: true },
  profilePicture: { type: String, default: null },
  score:          { type: Number, required: true },   // 0–1000
  accuracy:       { type: Number, required: true },   // 0–100 (%)
  totalAttempted: { type: Number, required: true },   // MCQs attempted in the period
  correctCount:   { type: Number, required: true },
  delta:          { type: Number, default: null },    // mostimproved only: current - prev week score
}, { _id: false });

const leaderboardSnapshotSchema = new mongoose.Schema({
  type: {
    type:     String,
    enum:     ['alltime', 'weekly', 'monthly', 'mostimproved', 'subject'],
    required: true,
  },
  subjectTitle: { type: String, default: null },  // lowercase-trimmed; null for global boards
  periodStart:  { type: Date,   default: null },  // start of the window (weekly/monthly/mostimproved)
  entries:      [entrySchema],                    // top 50 — stored sorted by rank
  // Total number of users with a rank on this board. Used by dashboard
  // percentile calc so it doesn't have to countDocuments() LeaderboardUserRank
  // on every cache miss.
  totalRanked:  { type: Number, default: 0 },
  computedAt:   { type: Date,   default: Date.now },
}, { timestamps: false });

// One snapshot document per (type, subjectTitle) pair
leaderboardSnapshotSchema.index({ type: 1, subjectTitle: 1 }, { unique: true });

module.exports = mongoose.model('LeaderboardSnapshot', leaderboardSnapshotSchema);
