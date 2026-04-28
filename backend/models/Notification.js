const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:      { type: String, enum: ['reply', 'answer', 'helpful'], required: true },
  actor:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorName: { type: String },
  post:      { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  reply:     { type: mongoose.Schema.Types.ObjectId, ref: 'Reply' },
  snippet:   { type: String, maxlength: 120 },
  isRead:    { type: Boolean, default: false },
  // For collapsed notifications (currently only `helpful`). When N students
  // mark the same reply helpful, we keep ONE unread doc and increment count
  // instead of creating N docs. `actor` / `actorName` reflect the latest actor.
  count:     { type: Number, default: 1 },
}, { timestamps: true });

NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, isRead: 1 });
// Upsert filter for collapsing helpful notifications — supports the
// findOneAndUpdate({ recipient, type, reply, isRead: false }) pattern.
NotificationSchema.index({ recipient: 1, type: 1, reply: 1, isRead: 1 });
// TTL: auto-delete notifications older than 30 days. Keeps the collection
// bounded forever. MongoDB's TTL monitor sweeps every 60 seconds.
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('Notification', NotificationSchema);
