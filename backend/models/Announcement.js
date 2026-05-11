const mongoose = require('mongoose');

// ── Announcements ────────────────────────────────────────────────────────────
// Broadcast posts created by admins/teachers and shown to all eligible users.
// Read-only for end users — there is no per-user unread row. Instead each user
// stores a single `announcementsSeenAt` timestamp (on User) and the unread
// badge is `count(createdAt > announcementsSeenAt)`. That keeps writes O(1)
// per user regardless of how many announcements exist.
// ─────────────────────────────────────────────────────────────────────────────
const AnnouncementSchema = new mongoose.Schema({
  title:    { type: String, required: true, trim: true, maxlength: 200 },
  message:  { type: String, default: '', maxlength: 5000 },
  // Drives icon + accent color on the client.
  type:     { type: String, enum: ['info', 'test', 'update', 'urgent'], default: 'info', index: true },
  // Who is allowed to see this announcement.
  audience: { type: String, enum: ['everyone', 'students', 'teachers', 'admins'], default: 'everyone', index: true },
  link:       { type: String, default: '' },
  buttonText: { type: String, default: 'Open', maxlength: 40 },
  pinned:     { type: Boolean, default: false },
  expiresAt:  { type: Date, default: null },

  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, default: '' },
}, { timestamps: true });

// Primary list query: pinned first, newest next, filtered by audience and not-expired.
// This compound index covers the dominant access pattern (list endpoint, dashboard
// widget, SSE connect hydrate) so MongoDB never scans the collection.
AnnouncementSchema.index({ pinned: -1, createdAt: -1 });
AnnouncementSchema.index({ audience: 1, pinned: -1, createdAt: -1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);
