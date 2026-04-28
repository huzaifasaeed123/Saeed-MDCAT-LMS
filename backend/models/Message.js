const mongoose = require('mongoose');
const { Schema } = mongoose;

const MessageSchema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content:        { type: String, required: true, maxlength: 2000, trim: true },
}, { timestamps: true });

// Fetch messages chronologically within a conversation
MessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', MessageSchema);
