const mongoose = require('mongoose');
const { Schema } = mongoose;

const ConversationSchema = new Schema({
  participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage:   { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now },
  lastMessageBy: { type: Schema.Types.ObjectId, ref: 'User' },
  // Map: userId (string) → unread count for that participant
  unreadCounts: { type: Map, of: Number, default: new Map() },
}, { timestamps: true });

// Fast lookup: all conversations for a user, newest first
ConversationSchema.index({ participants: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
