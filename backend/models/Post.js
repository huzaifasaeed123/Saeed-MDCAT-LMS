const mongoose = require('mongoose');

const PollOptionSchema = new mongoose.Schema({
  text:  { type: String, required: true, trim: true, maxlength: 200 },
  votes: [{ type: mongoose.Schema.Types.ObjectId }],
}, { _id: true });

const PostSchema = new mongoose.Schema({
  author:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Embedded snapshot — avoids a populate join on every feed read.
  // communityPoints is captured at post-creation time (so the badge reflects
  // the user's standing at the moment they posted). It does not auto-update
  // when the user earns more points, which is the explicit trade-off for
  // skipping the User join on every feed read.
  authorSnapshot: {
    fullName:        { type: String },
    role:            { type: String },
    profilePicture:  { type: String },
    communityPoints: { type: Number, default: 0 },
  },
  category: {
    type: String,
    enum: ['general', 'physics', 'chemistry', 'biology', 'english', 'logical_reasoning'],
    required: true,
  },
  type: {
    type: String,
    enum: ['doubt', 'discussion', 'poll', 'announcement'],
    required: true,
  },
  content:  { type: String, default: '', maxlength: 5000 },
  images:   [{ type: String }],

  // Embedded poll — only present when type === 'poll'
  poll: {
    options:       { type: [PollOptionSchema] },
    isQuizMode:    { type: Boolean, default: false },
    correctOption: { type: Number },
    explanation:   { type: String, maxlength: 1000 },
  },

  isPinned:   { type: Boolean, default: false },
  isAnswered: { type: Boolean, default: false },
  savedBy:    [{ type: mongoose.Schema.Types.ObjectId }],
  replyCount: { type: Number, default: 0 },
  isEdited:   { type: Boolean, default: false },
}, { timestamps: true });

PostSchema.index({ createdAt: -1 });
PostSchema.index({ category: 1, createdAt: -1 });
PostSchema.index({ type: 1, createdAt: -1 });
PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ isPinned: -1, createdAt: -1 });
PostSchema.index({ isAnswered: 1, type: 1 });
PostSchema.index({ savedBy: 1 });
// Search uses regex on content + authorSnapshot.fullName. The fullName index
// helps the regex prefix scan; content regex is unindexed (full-collection scan
// at search time, acceptable on small/medium collections).
PostSchema.index({ 'authorSnapshot.fullName': 1 });

module.exports = mongoose.model('Post', PostSchema);
