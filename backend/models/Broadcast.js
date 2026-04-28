const mongoose = require('mongoose');
const { Schema } = mongoose;

// One document per admin broadcast. readBy tracks which students/teachers have
// read it. 10k students × 12 bytes/ObjectId = ~120KB max per doc — well within
// MongoDB's 16MB document limit and only relevant for occasional broadcasts.
const BroadcastSchema = new Schema({
  sender:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 2000, trim: true },
  readBy:  [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

BroadcastSchema.index({ createdAt: -1 });
BroadcastSchema.index({ sender: 1, createdAt: -1 });

module.exports = mongoose.model('Broadcast', BroadcastSchema);
