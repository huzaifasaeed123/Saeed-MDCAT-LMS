// src/modules/tests/pages/TestFormPage.jsx
//
// Admin Test Create / Edit form — themed to match the design system. Two
// section cards (Basic Info + Test Settings), a sticky-feeling submit row,
// and the page title pushed up into the global top bar via usePageHeader().
//
// All state, effects, validation and API calls are preserved untouched —
// only the JSX, Tailwind classes, and the page header wiring changed.
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiSave, FiClock, FiEye } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';
import { toPktInputValue, pktInputToUtcIso } from '../../../shared/utils/pktDate';

const TestFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    passingScore: 50,
    difficultyLevel: 'Medium',
    instructions: '',
    // null = unlimited (default). When the admin flips the toggle off, this
    // becomes a positive integer that startTest enforces against students.
    maxAttempts: null,
    // Allowed test modes. Both = student picks at start (default). Pick a
    // single mode to lock the test to that mode.
    allowedModes: ['tutor', 'timer'],

    // ── Availability scheduling (PKT) ───────────────────────────────────
    // 'public'      → always open
    // 'unlock_date' → opens at unlockAt
    // 'window'      → opens at unlockAt, closes at lockAt
    // unlockAt/lockAt are stored as UTC ISO strings; the form inputs
    // accept PKT wall-clock values and convert in both directions.
    availability: 'public',
    unlockAt: '',
    lockAt:   '',

    // Absolute PKT date/time after which "Review answers" becomes active
    // for any completed attempt of this test. Empty string = always
    // immediately available (the default).
    reviewUnlockAt: '',
  });

  useEffect(() => {
    if (isEdit) fetchTest();
  }, [id]);

  const fetchTest = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/tests/${id}`);
      if (res.data.success) {
        const d = res.data.data;
        setFormData({
          title: d.title || '',
          description: d.description || '',
          passingScore: d.passingScore ?? 50,
          difficultyLevel: d.difficultyLevel || 'Medium',
          instructions: d.instructions || '',
          maxAttempts: d.maxAttempts ?? null,
          allowedModes: Array.isArray(d.allowedModes) && d.allowedModes.length > 0
            ? d.allowedModes
            : ['tutor', 'timer'],
          availability:   d.availability || 'public',
          unlockAt:       d.unlockAt || '',
          lockAt:         d.lockAt   || '',
          reviewUnlockAt: d.reviewUnlockAt || '',
        });
      }
    } catch {
      toast.error('Failed to load test');
      navigate('/tests');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await apiClient.put(`/tests/${id}`, formData);
        toast.success('Test updated');
      } else {
        const res = await apiClient.post('/tests', formData);
        toast.success('Test created');
        // Navigate to test detail so admin can add MCQs right away
        const newId = res.data?.data?._id;
        navigate(newId ? `/tests/${newId}` : '/tests');
        return;
      }
      navigate('/tests');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save test');
    } finally {
      setSaving(false);
    }
  };

  // ── Push title/subtitle to top navbar ───────────────────────────────────
  const headerSubtitle = isEdit
    ? 'Update test settings, modes and instructions.'
    : 'Fill in the basic details. You can add MCQs from a Question Bank after creating the test.';

  const headerAction = useMemo(() => (
    <button
      type="button"
      onClick={() => navigate('/tests')}
      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[var(--text-muted)] border border-[var(--border)] rounded-xl hover:bg-[var(--bg-muted)] transition-colors"
    >
      <FiArrowLeft className="w-4 h-4" /> Back to tests
    </button>
  ), [navigate]);

  usePageHeader({
    title:    isEdit ? 'Edit Test' : 'Create Test',
    subtitle: headerSubtitle,
    action:   headerAction,
  });

  // Shared classes
  const inputCls =
    'w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm ' +
    'text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-primary-400 transition';
  const labelCls = 'block text-sm font-medium text-[var(--text)] mb-1';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Mobile-only back button — top bar action slot is desktop-only */}
      <div className="md:hidden mb-4">
        <button
          type="button"
          onClick={() => navigate('/tests')}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" /> Back to tests
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info card */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 space-y-4">
          <h2 className="font-display text-base font-bold text-[var(--text-strong)]">Basic Information</h2>

          <div>
            <label className={labelCls}>
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Biology Mock Test – Chapter 5"
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Optional description for students…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* Test Settings card */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 space-y-5">
          <h2 className="font-display text-base font-bold text-[var(--text-strong)]">Test Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Passing Score (%)</label>
              <input
                type="number"
                name="passingScore"
                value={formData.passingScore}
                onChange={handleChange}
                min={0}
                max={100}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Difficulty</label>
              <select
                name="difficultyLevel"
                value={formData.difficultyLevel}
                onChange={handleChange}
                className={inputCls}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Allowed test modes — multi-select. Both checked (default) lets
              the student pick at start. Lock to one mode to force it. */}
          <div>
            <label className={`${labelCls} mb-2`}>Allowed Test Modes</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'tutor', label: 'Tutor mode',  hint: 'Instant feedback per question' },
                { value: 'timer', label: 'Timed mode',  hint: 'Single time-budgeted attempt' },
              ].map((opt) => {
                const checked = formData.allowedModes.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setFormData((p) => {
                      // Toggle, but never let the array become empty — at
                      // least one mode must remain selected.
                      const next = checked
                        ? p.allowedModes.filter((m) => m !== opt.value)
                        : [...p.allowedModes, opt.value];
                      return { ...p, allowedModes: next.length > 0 ? next : p.allowedModes };
                    })}
                    className={`flex-1 min-w-[160px] text-left p-3 rounded-xl border-2 transition-colors ${
                      checked
                        ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/30 dark:border-primary-700'
                        : 'border-[var(--border)] hover:border-primary-200 dark:hover:border-primary-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--text-strong)]">{opt.label}</span>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        checked
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-[var(--border)]'
                      }`}>
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{opt.hint}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[var(--text-faint)] mt-1.5">
              {formData.allowedModes.length === 2
                ? 'Both modes allowed — student picks at start.'
                : `Test locked to ${formData.allowedModes[0]} mode.`}
            </p>
          </div>

          {/* Attempt limit — toggle "Unlimited" on/off; show number input when off */}
          <div>
            <label className={`${labelCls} mb-2`}>Allowed Attempts</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFormData((p) => ({
                  ...p,
                  maxAttempts: p.maxAttempts == null ? 1 : null,
                }))}
                className={`relative inline-block w-11 h-6 rounded-full transition-colors ${
                  formData.maxAttempts == null ? 'bg-emerald-500' : 'bg-[var(--border)]'
                }`}
                title="Toggle unlimited attempts"
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                  formData.maxAttempts == null ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
              <span className="text-sm text-[var(--text)]">
                {formData.maxAttempts == null ? 'Unlimited attempts' : 'Limit attempts to'}
              </span>
              {formData.maxAttempts != null && (
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={formData.maxAttempts}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setFormData((p) => ({ ...p, maxAttempts: Number.isFinite(v) && v > 0 ? v : 1 }));
                  }}
                  className="w-24 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm transition"
                />
              )}
            </div>
            <p className="text-xs text-[var(--text-faint)] mt-1.5">
              Admins/teachers are always exempt — this limit applies to students only.
            </p>
          </div>

          <div>
            <label className={labelCls}>Instructions</label>
            <textarea
              name="instructions"
              value={formData.instructions}
              onChange={handleChange}
              rows={4}
              placeholder="Instructions shown to students before the test…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* ── Availability & Review scheduling card ─────────────────────
            All times here are Pakistan Standard Time (PKT, +05:00). The
            UI accepts wall-clock PKT values and stores them as proper UTC
            ISO strings on the backend, so the schedule is consistent
            regardless of where the server or the user is. */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="font-display text-base font-bold text-[var(--text-strong)]">Availability & Review</h2>
            <p className="text-xs text-[var(--text-faint)] mt-1">All times are interpreted as Pakistan Standard Time (PKT).</p>
          </div>

          {/* Availability mode */}
          <div>
            <label className={`${labelCls} inline-flex items-center gap-2`}>
              <FiClock className="w-4 h-4 text-primary-500" /> Availability
            </label>
            <select
              name="availability"
              value={formData.availability}
              onChange={(e) => setFormData((p) => ({
                ...p,
                availability: e.target.value,
                // Reset window dates when leaving window mode so stale
                // values don't sneak back in if admin toggles modes around.
                ...(e.target.value === 'public'      ? { unlockAt: '', lockAt: '' } : {}),
                ...(e.target.value === 'unlock_date' ? { lockAt: '' }              : {}),
              }))}
              className={inputCls}
            >
              <option value="public">Always public — open to everyone, any time</option>
              <option value="unlock_date">Open at a specific date &amp; time</option>
              <option value="window">Time window — opens, then closes</option>
            </select>
            <p className="text-xs text-[var(--text-faint)] mt-1.5">
              {formData.availability === 'public' && 'Students can start this test whenever they want.'}
              {formData.availability === 'unlock_date' && 'Students can\'t start the test before the Opens-at date below.'}
              {formData.availability === 'window' && 'Students can start the test only between the two dates below. In-progress attempts are not interrupted when the window closes.'}
            </p>
          </div>

          {/* Window date inputs — visible for unlock_date & window modes */}
          {(formData.availability === 'unlock_date' || formData.availability === 'window') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Opens at <span className="text-[var(--text-faint)] font-normal text-xs">(PKT)</span></label>
                <input
                  type="datetime-local"
                  value={toPktInputValue(formData.unlockAt)}
                  onChange={(e) => setFormData((p) => ({
                    ...p,
                    unlockAt: pktInputToUtcIso(e.target.value),
                  }))}
                  className={inputCls}
                />
              </div>
              {formData.availability === 'window' && (
                <div>
                  <label className={labelCls}>Closes at <span className="text-[var(--text-faint)] font-normal text-xs">(PKT)</span></label>
                  <input
                    type="datetime-local"
                    value={toPktInputValue(formData.lockAt)}
                    onChange={(e) => setFormData((p) => ({
                      ...p,
                      lockAt: pktInputToUtcIso(e.target.value),
                    }))}
                    className={inputCls}
                  />
                </div>
              )}
            </div>
          )}

          {/* Review unlock */}
          <div className="pt-2 border-t border-[var(--border-faint)]">
            <label className={`${labelCls} inline-flex items-center gap-2`}>
              <FiEye className="w-4 h-4 text-primary-500" /> Review unlock time
            </label>
            <div className="flex items-center gap-3">
              {/* Toggle: always-immediate vs scheduled */}
              <button
                type="button"
                onClick={() => setFormData((p) => ({
                  ...p,
                  reviewUnlockAt: p.reviewUnlockAt ? '' : pktInputToUtcIso(toPktInputValue(new Date().toISOString())),
                }))}
                className={`relative inline-block w-11 h-6 rounded-full transition-colors ${
                  formData.reviewUnlockAt ? 'bg-emerald-500' : 'bg-[var(--border)]'
                }`}
                title="Toggle scheduled review unlock"
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                  formData.reviewUnlockAt ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
              <span className="text-sm text-[var(--text)]">
                {formData.reviewUnlockAt
                  ? 'Review unlocks at a scheduled PKT time'
                  : 'Review available immediately after submission'}
              </span>
            </div>
            {formData.reviewUnlockAt && (
              <input
                type="datetime-local"
                value={toPktInputValue(formData.reviewUnlockAt)}
                onChange={(e) => setFormData((p) => ({
                  ...p,
                  reviewUnlockAt: pktInputToUtcIso(e.target.value),
                }))}
                className={`${inputCls} mt-3 max-w-sm`}
              />
            )}
            <p className="text-xs text-[var(--text-faint)] mt-1.5">
              When set, the "Review answers" button stays disabled for every student until this time has passed. Useful for tests where you don't want answer keys leaking until the window has closed for everyone.
            </p>
          </div>
        </div>

        {/* Submit row */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/tests')}
            className="px-5 py-2.5 text-sm font-semibold text-[var(--text-muted)] border border-[var(--border)] rounded-xl hover:bg-[var(--bg-muted)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-brand text-sm disabled:opacity-60"
          >
            <FiSave className="w-4 h-4" />
            {saving ? 'Saving…' : isEdit ? 'Update Test' : 'Create Test & Add MCQs →'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TestFormPage;
