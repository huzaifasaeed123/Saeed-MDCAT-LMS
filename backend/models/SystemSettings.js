const mongoose = require('mongoose');

// Single-document settings — always upserted with key 'global'
const systemSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  maxMcqsPerAutoTest: { type: Number, default: 100 },
  defaultQuestionBankId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank', default: null },

  // ── Session management ────────────────────────────────────────────────────
  // 'multi'  → user can be logged in on unlimited devices simultaneously
  // 'single' → new login replaces all previous sessions (sessionVersion check)
  sessionMode: { type: String, enum: ['multi', 'single'], default: 'multi' },
  // How many days the refresh-token cookie lives (baked into JWT expiry at sign time)
  sessionDurationDays: { type: Number, default: 547, min: 1, max: 3650 },

  // Community point values — editable by admin
  communityPoints: {
    post:    { type: Number, default: 2 },
    reply:   { type: Number, default: 1 },
    helpful: { type: Number, default: 1 },
    answer:  { type: Number, default: 15 },
  },
}, { timestamps: true });

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
