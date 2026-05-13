const mongoose = require('mongoose');

// ── Per-user per-day to-do list ──────────────────────────────────────────────
// The morning-planner items that surface on the Today page. Auto-seeded from
// due revisions + tracker gaps + new topics when the student taps "Plan my
// day". Tasks can also be hand-entered (custom type). Self-contained — no
// joins required for the basic CRUD path; the Today + Week views denormalise
// topic info onto the response via $lookup when needed.
// ─────────────────────────────────────────────────────────────────────────────
const UserDailyTodoSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dayPkt:      { type: String, required: true }, // 'YYYY-MM-DD' PKT
  topic:       { type: mongoose.Schema.Types.ObjectId, ref: 'SyllabusTopic', default: null },
  taskType:    { type: String, enum: ['lecture', 'book', 'mcqs', 'revise', 'custom'], required: true },
  taskText:    { type: String, default: '', trim: true },
  targetCount: { type: Number, default: 0 }, // e.g. "50 MCQs"
  done:        { type: Boolean, default: false },
  doneAt:      { type: Date,    default: null },
  sortOrder:   { type: Number,  default: 0 },
}, { timestamps: true });

// Primary list query: this user's items for a given day, oldest done last.
UserDailyTodoSchema.index({ user: 1, dayPkt: 1, sortOrder: 1 });
// Used by /todo/seed dedup check + week view scan.
UserDailyTodoSchema.index({ user: 1, dayPkt: 1, topic: 1, taskType: 1 });

module.exports = mongoose.model('UserDailyTodo', UserDailyTodoSchema);
