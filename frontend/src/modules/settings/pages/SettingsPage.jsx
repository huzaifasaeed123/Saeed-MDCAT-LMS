import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import {
  FiSave, FiSliders, FiDatabase,
  FiShield, FiMonitor, FiAlertCircle, FiCheck, FiAward, FiKey, FiLock, FiCopy,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

// ── Duration presets ──────────────────────────────────────────────────────────
const DURATION_PRESETS = [
  { label: '30 days',   value: 30  },
  { label: '90 days',   value: 90  },
  { label: '180 days',  value: 180 },
  { label: '1 year',    value: 365 },
  { label: '1.5 years', value: 547 },
  { label: '2 years',   value: 730 },
];

// ── Session mode cards ────────────────────────────────────────────────────────
const SESSION_MODES = [
  {
    value: 'multi',
    icon: FiMonitor,
    title: 'Multi-Device',
    description:
      'Users can be logged in on unlimited devices at the same time. All devices stay active independently.',
    badge: 'Recommended',
    badgeColor: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  },
  {
    value: 'single',
    icon: FiShield,
    title: 'Single Session',
    description:
      'A new login immediately invalidates all previous sessions. The old device is kicked out within 1 hour.',
    badge: 'Strict',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  },
];

// ─────────────────────────────────────────────────────────────────────────────

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    maxMcqsPerAutoTest:    100,
    defaultQuestionBankId: '',
    sessionMode:           'multi',
    sessionDurationDays:   547,
    communityPoints: { post: 2, reply: 1, helpful: 1, answer: 15 },
    googleDriveApiKey: '',
    // Service account key — write-only on the form (never pre-populated).
    // Leaving it empty on save means "don't change the existing key".
    googleServiceAccountKey: '',
  });
  // Derived from API — not editable directly
  const [hasServiceAccountKey,  setHasServiceAccountKey]  = useState(false);
  const [serviceAccountEmail,   setServiceAccountEmail]   = useState('');
  const [showSaKeyInput,        setShowSaKeyInput]        = useState(false);
  const [banks,   setBanks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  // Custom duration input toggle — shown when user types a value not in presets
  const [customDuration, setCustomDuration] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, banksRes] = await Promise.all([
          apiClient.get('/settings'),
          apiClient.get('/question-banks'),
        ]);
        const s = settingsRes.data.data || {};
        const dur = s.sessionDurationDays ?? 547;
        setSettings({
          maxMcqsPerAutoTest:    s.maxMcqsPerAutoTest    ?? 100,
          defaultQuestionBankId: s.defaultQuestionBankId?._id || s.defaultQuestionBankId || '',
          sessionMode:           s.sessionMode           ?? 'multi',
          sessionDurationDays:   dur,
          communityPoints: {
            post:    s.communityPoints?.post    ?? 2,
            reply:   s.communityPoints?.reply   ?? 1,
            helpful: s.communityPoints?.helpful ?? 1,
            answer:  s.communityPoints?.answer  ?? 15,
          },
          googleDriveApiKey:        s.googleDriveApiKey ?? '',
          googleServiceAccountKey:  '',  // never pre-filled from server
        });
        setHasServiceAccountKey(!!s.hasServiceAccountKey);
        setServiceAccountEmail(s.serviceAccountEmail || '');
        // Show custom input if saved value is not one of the presets
        if (!DURATION_PRESETS.some((p) => p.value === dur)) setCustomDuration(true);
        if (banksRes.data.success) setBanks(banksRes.data.data);
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    const days = Number(settings.sessionDurationDays);
    if (!settings.maxMcqsPerAutoTest || Number(settings.maxMcqsPerAutoTest) < 1) {
      toast.error('Max MCQs must be at least 1');
      return;
    }
    if (!days || days < 1 || days > 3650) {
      toast.error('Session duration must be between 1 and 3650 days');
      return;
    }

    setSaving(true);
    try {
      await apiClient.put('/settings', {
        maxMcqsPerAutoTest:    Number(settings.maxMcqsPerAutoTest),
        defaultQuestionBankId: settings.defaultQuestionBankId || null,
        sessionMode:           settings.sessionMode,
        sessionDurationDays:   days,
        communityPoints: {
          post:    Math.max(0, Number(settings.communityPoints.post)    || 0),
          reply:   Math.max(0, Number(settings.communityPoints.reply)   || 0),
          helpful: Math.max(0, Number(settings.communityPoints.helpful) || 0),
          answer:  Math.max(0, Number(settings.communityPoints.answer)  || 0),
        },
        googleDriveApiKey: settings.googleDriveApiKey.trim(),
        // Only include SA key if admin typed something — empty = "leave unchanged"
        ...(settings.googleServiceAccountKey.trim()
          ? { googleServiceAccountKey: settings.googleServiceAccountKey.trim() }
          : {}),
      });
      toast.success('Settings saved successfully');
      // Refresh SA key status after save
      setSettings((s) => ({ ...s, googleServiceAccountKey: '' }));
      setShowSaKeyInput(false);
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const setDuration = (val) => {
    setSettings((s) => ({ ...s, sessionDurationDays: val }));
  };

  // Memoise so PageHeaderContext doesn't see a fresh JSX object every render
  // (would cause its effect to re-fire → setHeader → infinite re-render loop).
  const headerAction = useMemo(() => (
    <button
      onClick={handleSave}
      disabled={saving || loading}
      className="btn-brand text-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {saving ? (
        <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-white" />
      ) : (
        <FiSave className="w-4 h-4" />
      )}
      {saving ? 'Saving…' : 'Save Settings'}
    </button>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [saving, loading, settings]);

  usePageHeader({
    title:    'System Settings',
    subtitle: 'Configure platform-wide defaults',
    action:   headerAction,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

        {/* ── Auto Test Generator ──────────────────────────────────────────── */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-6">
          <div className="flex items-center gap-2 mb-5">
            <FiSliders className="w-5 h-5 text-primary-500" />
            <h2 className="text-base font-semibold text-[var(--text-strong)]">Auto Test Generator</h2>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              Max MCQs per Auto-Generated Test
            </label>
            <p className="text-xs text-[var(--text-faint)] mb-2">
              Students and teachers cannot generate a test with more than this many MCQs.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={500}
                value={settings.maxMcqsPerAutoTest}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, maxMcqsPerAutoTest: e.target.value }))
                }
                className="w-36 px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
              />
              <span className="text-sm text-[var(--text-faint)]">MCQs maximum</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              Default Question Bank
            </label>
            <p className="text-xs text-[var(--text-faint)] mb-2">
              Pre-selected when users open the Auto Test Generator. Users can still change it.
            </p>
            <div className="flex items-center gap-2">
              <FiDatabase className="w-4 h-4 text-[var(--text-faint)] flex-shrink-0" />
              <select
                value={settings.defaultQuestionBankId}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, defaultQuestionBankId: e.target.value }))
                }
                className="flex-1 px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="">— No default —</option>
                {banks.map((b) => (
                  <option key={b._id} value={b._id}>{b.title}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Session Management ───────────────────────────────────────────── */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-6">
          <div className="flex items-center gap-2 mb-1">
            <FiShield className="w-5 h-5 text-secondary-600 dark:text-secondary-300" />
            <h2 className="text-base font-semibold text-[var(--text-strong)]">Session Management</h2>
          </div>
          <p className="text-xs text-[var(--text-faint)] mb-5">
            Controls how user login sessions work across devices.
          </p>

          {/* Mode selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--text)] mb-3">
              Session Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SESSION_MODES.map((mode) => {
                const Icon = mode.icon;
                const active = settings.sessionMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, sessionMode: mode.value }))}
                    className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                      active
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                        : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    {/* Checkmark */}
                    {active && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                        <FiCheck className="w-3 h-3 text-white" strokeWidth={3} />
                      </span>
                    )}

                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${active ? 'text-primary-600 dark:text-primary-300' : 'text-[var(--text-muted)]'}`} />
                      <span className={`text-sm font-semibold ${active ? 'text-primary-700 dark:text-primary-200' : 'text-[var(--text)]'}`}>
                        {mode.title}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${mode.badgeColor}`}>
                        {mode.badge}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      {mode.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Mode 2 info callout */}
            {settings.sessionMode === 'single' && (
              <div className="mt-3 flex gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3">
                <FiAlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-300 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-200">
                  <span className="font-semibold">Single Session enforcement:</span> When a user logs in
                  from a new device, the previous session is invalidated at the next token refresh
                  (within 1 hour). The student will be redirected to the login page automatically.
                </p>
              </div>
            )}
          </div>

          {/* Session Duration */}
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              Session Duration
            </label>
            <p className="text-xs text-[var(--text-faint)] mb-3">
              How long users stay logged in without activity. Applies to new logins — existing
              sessions keep their original duration.
            </p>

            {/* Preset pills */}
            <div className="flex flex-wrap gap-2 mb-3">
              {DURATION_PRESETS.map((p) => {
                const active = !customDuration && settings.sessionDurationDays === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setCustomDuration(false);
                      setDuration(p.value);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      active
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-300'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCustomDuration(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  customDuration
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-300'
                }`}
              >
                Custom
              </button>
            </div>

            {/* Custom days input */}
            {customDuration && (
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={settings.sessionDurationDays}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-32 px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
                />
                <span className="text-sm text-[var(--text-faint)]">days (max 3650)</span>
              </div>
            )}

            {/* Current value display */}
            <p className="mt-2 text-xs text-[var(--text-faint)]">
              Currently set to{' '}
              <span className="font-semibold text-[var(--text)]">
                {settings.sessionDurationDays} days
              </span>{' '}
              (~{(settings.sessionDurationDays / 365).toFixed(1)} years)
            </p>
          </div>

          {/* Mode-change disclaimer */}
          <div className="mt-4 flex gap-2 bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl p-3">
            <FiAlertCircle className="w-4 h-4 text-[var(--text-faint)] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text)]">Changes apply to new logins only.</span>{' '}
              Users who are already logged in will not be affected until their current session
              expires or they log in again.
            </p>
          </div>
        </div>

        {/* ── Community Points ─────────────────────────────────────────────── */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-6">
          <div className="flex items-center gap-2 mb-1">
            <FiAward className="w-5 h-5 text-secondary-600 dark:text-secondary-300" />
            <h2 className="text-base font-semibold text-[var(--text-strong)]">Community Points</h2>
          </div>
          <p className="text-xs text-[var(--text-faint)] mb-5">
            How many points users earn for community activity. Affects leaderboard ranking and badges.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'post',    label: 'Create a post',           desc: 'Awarded once per new post' },
              { key: 'reply',   label: 'Write a reply',           desc: 'Awarded once per reply' },
              { key: 'helpful', label: 'Reply marked helpful',    desc: 'Awarded to reply author (max 10/reply)' },
              { key: 'answer',  label: 'Reply marked as answer',  desc: 'Awarded to reply author when staff marks it' },
            ].map(({ key, label, desc }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">{label}</label>
                <p className="text-xs text-[var(--text-faint)] mb-2">{desc}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={settings.communityPoints[key]}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        communityPoints: { ...s.communityPoints, [key]: e.target.value },
                      }))
                    }
                    className="w-24 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary-400 placeholder:text-[var(--text-faint)]"
                  />
                  <span className="text-xs text-[var(--text-faint)]">points</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2 bg-secondary-50 dark:bg-secondary-950/30 border border-secondary-200 dark:border-secondary-900/50 rounded-xl p-3">
            <FiAlertCircle className="w-4 h-4 text-secondary-500 dark:text-secondary-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-secondary-700 dark:text-secondary-200">
              <span className="font-semibold">Live updates:</span> Changes take effect immediately for all
              new community activity. Existing user points are not retroactively recalculated.
            </p>
          </div>
        </div>

        {/* ── Integrations: Google Drive ───────────────────────────────────── */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-6">
          <div className="flex items-center gap-2 mb-1">
            <FiKey className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
            <h2 className="text-base font-semibold text-[var(--text-strong)]">Google Drive Integration</h2>
          </div>
          <p className="text-xs text-[var(--text-faint)] mb-4">
            Required for the Notes module's "Import from Drive" feature. Provide a Google Drive API key with Drive API enabled.
          </p>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">API key</label>
            <input
              type="password"
              value={settings.googleDriveApiKey}
              onChange={(e) => setSettings((s) => ({ ...s, googleDriveApiKey: e.target.value }))}
              placeholder="AIza…"
              className="w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-[var(--text-faint)] font-mono"
              autoComplete="off"
            />
            <p className="text-xs text-[var(--text-faint)] mt-2">
              Source folders must be shared as <span className="font-semibold">"Anyone with the link can view"</span>.
              Without a key, admins can still add individual files manually but bulk import is disabled.
            </p>
          </div>
        </div>

        {/* ── Service Account (Protected PDFs) ────────────────────────── */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-6">
          <div className="flex items-center gap-2 mb-1">
            <FiLock className="w-5 h-5 text-red-500 dark:text-red-300" />
            <h2 className="text-base font-semibold text-[var(--text-strong)]">Service Account (Protected PDFs)</h2>
          </div>
          <p className="text-xs text-[var(--text-faint)] mb-4">
            Enables the <span className="font-semibold">Protected mode</span> in Notes — files stay private on Google Drive and are
            streamed securely through the LMS server. Students never see the Drive URL.
          </p>

          {/* Current status */}
          {hasServiceAccountKey ? (
            <div className="mb-4 flex items-start gap-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-xl p-3">
              <FiCheck className="w-4 h-4 text-green-600 dark:text-green-300 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-700 dark:text-green-200">Service Account is configured</p>
                {serviceAccountEmail && (
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xs text-green-600 dark:text-green-300 font-mono truncate">{serviceAccountEmail}</p>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(serviceAccountEmail); toast.success('Email copied'); }}
                      className="flex-shrink-0 p-1 hover:bg-green-100 dark:hover:bg-green-900/40 rounded"
                      title="Copy service account email"
                    >
                      <FiCopy className="w-3.5 h-3.5 text-green-600 dark:text-green-300" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                  Share your private Drive folders with this email as <span className="font-semibold">Viewer</span> to use Protected mode.
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3">
              <FiAlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-300 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-200">
                No service account configured. Protected PDF mode is disabled. Paste a service account JSON key below to enable it.
              </p>
            </div>
          )}

          {/* Toggle paste area */}
          {!showSaKeyInput ? (
            <button
              type="button"
              onClick={() => setShowSaKeyInput(true)}
              className="text-sm font-medium text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 underline"
            >
              {hasServiceAccountKey ? 'Replace service account key' : 'Add service account key'}
            </button>
          ) : (
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">
                Paste Service Account JSON key
              </label>
              <p className="text-xs text-[var(--text-faint)] mb-2">
                Download from Google Cloud Console → IAM → Service Accounts → Keys → Add Key → JSON.
              </p>
              <textarea
                rows={6}
                value={settings.googleServiceAccountKey}
                onChange={(e) => setSettings((s) => ({ ...s, googleServiceAccountKey: e.target.value }))}
                placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "...",\n  "client_email": "..."\n}'}
                className="w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-300 placeholder:text-[var(--text-faint)] resize-none"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => { setShowSaKeyInput(false); setSettings((s) => ({ ...s, googleServiceAccountKey: '' })); }}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  Cancel
                </button>
                <p className="text-xs text-[var(--text-faint)] ml-auto">Saved when you click <span className="font-semibold">Save Settings</span> below.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Save ────────────────────────────────────────────────────────── */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold text-base transition-all disabled:opacity-50"
        >
          {saving ? (
            <div className="animate-spin h-5 w-5 rounded-full border-b-2 border-white" />
          ) : (
            <FiSave className="w-5 h-5" />
          )}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
    </div>
  );
};

export default SettingsPage;
