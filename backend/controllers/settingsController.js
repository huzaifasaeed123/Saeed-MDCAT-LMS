const SystemSettings = require('../models/SystemSettings');

/**
 * GET /api/settings
 * Any authenticated user — needed for maxMcqs display, default QB, and
 * frontend awareness of session mode (e.g. show "single session" warning).
 */
exports.getSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.findOne({ key: 'global' })
      .populate('defaultQuestionBankId', 'title');
    res.status(200).json({
      success: true,
      data: settings || {
        maxMcqsPerAutoTest: 100,
        defaultQuestionBankId: null,
        sessionMode: 'multi',
        sessionDurationDays: 547,
      },
    });
  } catch (error) {
    console.error('getSettings error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * PUT /api/settings
 * Admin only.
 *
 * Session mode notes:
 *  - Changing sessionMode only affects NEW logins. Users already logged in
 *    keep their current session until their refresh token expires or they
 *    log in again (which picks up the new mode).
 *  - Changing sessionDurationDays only affects tokens issued AFTER the change.
 *    Existing refresh tokens retain their original expiry (baked into the JWT).
 */
exports.updateSettings = async (req, res) => {
  try {
    const { maxMcqsPerAutoTest, defaultQuestionBankId, sessionMode, sessionDurationDays } = req.body;
    const update = {};

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

    const settings = await SystemSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: update },
      { upsert: true, new: true, runValidators: true }
    ).populate('defaultQuestionBankId', 'title');

    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('updateSettings error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
