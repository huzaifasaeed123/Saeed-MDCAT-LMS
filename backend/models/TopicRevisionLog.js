const mongoose = require('mongoose');

// ── Append-only audit of every Again/Good/Easy/Master tap ───────────────────
// Drives:
//   • the streak counter (consecutive review-days)
//   • per-day "reviewed N topics" stat on the Week calendar
//   • future analytics if admin wants to see usage
//
// Auto-expires after 180 days via a TTL index so the collection stays bounded
// without manual cleanup. 180 days is enough for the current academic-year
// streak; older history is irrelevant.
// ─────────────────────────────────────────────────────────────────────────────
const TopicRevisionLogSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic:        { type: mongoose.Schema.Types.ObjectId, ref: 'SyllabusTopic', required: true },
  outcome:      { type: String, enum: ['again', 'good', 'easy', 'master'], required: true },
  stageBefore:  { type: Number, default: 0 },
  stageAfter:   { type: Number, default: 0 },
  prevInterval: { type: Number, default: 0 },
  newInterval:  { type: Number, default: 0 },
  dayPkt:       { type: String, required: true }, // 'YYYY-MM-DD' PKT
}, { timestamps: true });

// Streak query: distinct dayPkt's for a user, newest first.
TopicRevisionLogSchema.index({ user: 1, dayPkt: -1 });
// TTL: drop logs older than 180 days. Mongo's TTL monitor sweeps every 60s.
TopicRevisionLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

module.exports = mongoose.model('TopicRevisionLog', TopicRevisionLogSchema);
