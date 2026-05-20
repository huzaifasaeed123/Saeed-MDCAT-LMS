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

  // Google Drive API key — used by the Notes module to import folder trees
  // from a public Drive folder. Set by admin via SettingsPage.
  googleDriveApiKey: { type: String, default: '' },

  // Google Service Account JSON key (stringified) — used to access private Drive
  // files for the "Protected" notes mode. Never returned to clients; only
  // hasServiceAccountKey + serviceAccountEmail are exposed via the settings API.
  googleServiceAccountKey: { type: String, default: '' },

  // ── Defaults applied on self-signup ──────────────────────────────────────
  // Used by /auth/register and Google OAuth signup. Admin-created accounts
  // bypass this (admin enables features explicitly via the access UI). All
  // feature flags default to false so existing installs keep their current
  // "deny by default" behaviour until the admin opts in.
  defaultUserAccess: {
    featureAccess: {
      autoTest:  { type: Boolean, default: false },
      community: { type: Boolean, default: false },
      videos:    { type: Boolean, default: false },
      notes:     { type: Boolean, default: false },
    },
    coursesGrantAll: { type: Boolean, default: false },
    courseAccess:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  },
}, { timestamps: true });

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
