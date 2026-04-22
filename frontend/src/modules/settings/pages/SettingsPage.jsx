import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  FiSave, FiSettings, FiDatabase, FiSliders,
  FiShield, FiMonitor, FiAlertCircle, FiCheck,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';

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
    badgeColor: 'bg-green-100 text-green-700',
  },
  {
    value: 'single',
    icon: FiShield,
    title: 'Single Session',
    description:
      'A new login immediately invalidates all previous sessions. The old device is kicked out within 1 hour.',
    badge: 'Strict',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
];

// ─────────────────────────────────────────────────────────────────────────────

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    maxMcqsPerAutoTest:    100,
    defaultQuestionBankId: '',
    sessionMode:           'multi',
    sessionDurationDays:   547,
  });
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
        });
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
      });
      toast.success('Settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const setDuration = (val) => {
    setSettings((s) => ({ ...s, sessionDurationDays: val }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
          <FiSettings className="w-5 h-5 text-gray-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-sm text-gray-500">Configure platform-wide defaults</p>
        </div>
      </div>

      <div className="space-y-5">

        {/* ── Auto Test Generator ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <FiSliders className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-800">Auto Test Generator</h2>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max MCQs per Auto-Generated Test
            </label>
            <p className="text-xs text-gray-400 mb-2">
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
                className="w-36 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <span className="text-sm text-gray-400">MCQs maximum</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Question Bank
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Pre-selected when users open the Auto Test Generator. Users can still change it.
            </p>
            <div className="flex items-center gap-2">
              <FiDatabase className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select
                value={settings.defaultQuestionBankId}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, defaultQuestionBankId: e.target.value }))
                }
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-1">
            <FiShield className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-800">Session Management</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">
            Controls how user login sessions work across devices.
          </p>

          {/* Mode selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
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
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {/* Checkmark */}
                    {active && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <FiCheck className="w-3 h-3 text-white" strokeWidth={3} />
                      </span>
                    )}

                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-700'}`}>
                        {mode.title}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${mode.badgeColor}`}>
                        {mode.badge}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {mode.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Mode 2 info callout */}
            {settings.sessionMode === 'single' && (
              <div className="mt-3 flex gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <FiAlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">Single Session enforcement:</span> When a user logs in
                  from a new device, the previous session is invalidated at the next token refresh
                  (within 1 hour). The student will be redirected to the login page automatically.
                </p>
              </div>
            )}
          </div>

          {/* Session Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session Duration
            </label>
            <p className="text-xs text-gray-400 mb-3">
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
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
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
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
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
                  className="w-32 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-sm text-gray-400">days (max 3650)</span>
              </div>
            )}

            {/* Current value display */}
            <p className="mt-2 text-xs text-gray-400">
              Currently set to{' '}
              <span className="font-semibold text-gray-600">
                {settings.sessionDurationDays} days
              </span>{' '}
              (~{(settings.sessionDurationDays / 365).toFixed(1)} years)
            </p>
          </div>

          {/* Mode-change disclaimer */}
          <div className="mt-4 flex gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
            <FiAlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-gray-600">Changes apply to new logins only.</span>{' '}
              Users who are already logged in will not be affected until their current session
              expires or they log in again.
            </p>
          </div>
        </div>

        {/* ── Save ────────────────────────────────────────────────────────── */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base transition-all disabled:opacity-50"
        >
          {saving ? (
            <div className="animate-spin h-5 w-5 rounded-full border-b-2 border-white" />
          ) : (
            <FiSave className="w-5 h-5" />
          )}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
