const SystemSettings = require('../models/SystemSettings');

/**
 * GET /api/settings
 * Any authenticated user. The service account JSON key is NEVER returned —
 * only hasServiceAccountKey (bool) and serviceAccountEmail (string) are exposed.
 */
exports.getSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.findOne({ key: 'global' })
      .populate('defaultQuestionBankId', 'title');

    const data = settings
      ? settings.toObject()
      : {
          maxMcqsPerAutoTest: 100,
          defaultQuestionBankId: null,
          sessionMode: 'multi',
          sessionDurationDays: 547,
          googleDriveApiKey: '',
          googleServiceAccountKey: '',
        };

    // Strip the raw key; expose only safe derived fields.
    const rawKey = data.googleServiceAccountKey || '';
    data.hasServiceAccountKey = rawKey.length > 0;
    if (rawKey) {
      try {
        const creds = JSON.parse(rawKey);
        data.serviceAccountEmail = creds.client_email || null;
      } catch {
        data.serviceAccountEmail = null;
      }
    } else {
      data.serviceAccountEmail = null;
    }
    delete data.googleServiceAccountKey;

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('getSettings error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * PUT /api/settings
 * Admin only.
 *
 * googleServiceAccountKey — only saved when non-empty (passing empty string
 * does NOT clear an existing key; use a dedicated clear action if needed).
 */
exports.updateSettings = async (req, res) => {
  try {
    const {
      maxMcqsPerAutoTest,
      defaultQuestionBankId,
      sessionMode,
      sessionDurationDays,
      communityPoints,
      googleDriveApiKey,
      googleServiceAccountKey,
      defaultUserAccess,
    } = req.body;

    const update = {};

    // ── Default access preset for self-signups ───────────────────────────
    // Whitelist + coerce. Unknown sub-keys are ignored. courseAccess is left
    // unvalidated against the Course collection here; the existing
    // grant/revoke flow already proves an admin can name real ids and an
    // invalid id just means no course matches at access-check time.
    if (defaultUserAccess && typeof defaultUserAccess === 'object') {
      const fa = defaultUserAccess.featureAccess || {};
      if (fa.autoTest  !== undefined) update['defaultUserAccess.featureAccess.autoTest']  = !!fa.autoTest;
      if (fa.community !== undefined) update['defaultUserAccess.featureAccess.community'] = !!fa.community;
      if (fa.videos    !== undefined) update['defaultUserAccess.featureAccess.videos']    = !!fa.videos;
      if (fa.notes     !== undefined) update['defaultUserAccess.featureAccess.notes']     = !!fa.notes;
      if (defaultUserAccess.coursesGrantAll !== undefined) {
        update['defaultUserAccess.coursesGrantAll'] = !!defaultUserAccess.coursesGrantAll;
      }
      if (Array.isArray(defaultUserAccess.courseAccess)) {
        const mongoose = require('mongoose');
        update['defaultUserAccess.courseAccess'] = defaultUserAccess.courseAccess
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));
      }
    }

    if (maxMcqsPerAutoTest !== undefined) {
      const n = Number(maxMcqsPerAutoTest);
      if (!n || n < 1) return res.status(400).json({ success: false, message: 'maxMcqsPerAutoTest must be at least 1' });
      update.maxMcqsPerAutoTest = n;
    }
    if (defaultQuestionBankId !== undefined) update.defaultQuestionBankId = defaultQuestionBankId || null;
    if (sessionMode !== undefined) {
      if (!['multi', 'single'].includes(sessionMode))
        return res.status(400).json({ success: false, message: 'sessionMode must be "multi" or "single"' });
      update.sessionMode = sessionMode;
    }
    if (sessionDurationDays !== undefined) {
      const d = Number(sessionDurationDays);
      if (!d || d < 1 || d > 3650)
        return res.status(400).json({ success: false, message: 'sessionDurationDays must be between 1 and 3650' });
      update.sessionDurationDays = d;
    }
    if (communityPoints !== undefined) {
      const { post, reply, helpful, answer } = communityPoints;
      if (post    !== undefined) update['communityPoints.post']    = Math.max(0, Number(post)    || 0);
      if (reply   !== undefined) update['communityPoints.reply']   = Math.max(0, Number(reply)   || 0);
      if (helpful !== undefined) update['communityPoints.helpful'] = Math.max(0, Number(helpful) || 0);
      if (answer  !== undefined) update['communityPoints.answer']  = Math.max(0, Number(answer)  || 0);
      require('../utils/pointsService').invalidatePointsCache();
    }
    if (googleDriveApiKey !== undefined) {
      update.googleDriveApiKey = String(googleDriveApiKey || '').trim();
    }
    // Only save if non-empty — empty means "leave existing key unchanged".
    if (googleServiceAccountKey && String(googleServiceAccountKey).trim()) {
      const trimmed = String(googleServiceAccountKey).trim();
      try {
        const parsed = JSON.parse(trimmed);
        if (!parsed.client_email || !parsed.private_key) {
          return res.status(400).json({
            success: false,
            message: 'Service Account JSON must contain client_email and private_key fields',
          });
        }
      } catch {
        return res.status(400).json({ success: false, message: 'Service Account key must be valid JSON' });
      }
      update.googleServiceAccountKey = trimmed;
      // Bust the in-memory token cache in driveService
      require('../utils/driveService').invalidateTokenCache();
    }

    const settings = await SystemSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: update },
      { upsert: true, new: true, runValidators: true }
    ).populate('defaultQuestionBankId', 'title');

    // Build safe response (same as getSettings logic)
    const data = settings.toObject();
    const rawKey = data.googleServiceAccountKey || '';
    data.hasServiceAccountKey = rawKey.length > 0;
    if (rawKey) {
      try { data.serviceAccountEmail = JSON.parse(rawKey).client_email || null; }
      catch { data.serviceAccountEmail = null; }
    } else {
      data.serviceAccountEmail = null;
    }
    delete data.googleServiceAccountKey;

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('updateSettings error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
