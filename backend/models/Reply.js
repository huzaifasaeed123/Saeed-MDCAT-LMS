const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema({
  post:         { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  author:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Embedded snapshot — captured at reply creation time. Eliminates the
  // populate join on every reply load. communityPoints is "as of when the
  // reply was made" — same trade-off as Post.authorSnapshot.
  authorSnapshot: {
    fullName:        { type: String },
    role:            { type: String },
    profilePicture:  { type: String },
    communityPoints: { type: Number, default: 0 },
  },
  content:      { type: String, default: '', maxlength: 3000 },
  images:       [{ type: String }],
  isAnswer:     { type: Boolean, default: false },
  helpfulVotes: [{ type: mongoose.Schema.Types.ObjectId }],
  helpfulCount: { type: Number, default: 0 },
  isEdited:     { type: Boolean, default: false },
}, { timestamps: true });

ReplySchema.index({ post: 1, createdAt: 1 });
ReplySchema.index({ author: 1 });

module.exports = mongoose.model('Reply', ReplySchema);
