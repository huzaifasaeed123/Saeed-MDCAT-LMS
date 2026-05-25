import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiClock, FiList, FiTarget, FiCheckCircle, FiAlertCircle, FiPlayCircle,
  FiBookOpen, FiRotateCcw, FiInfo, FiArrowLeft, FiAward,
  FiZap, FiLock,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';
import { resolveScheduleStatus, fmtPktDateTime, fmtCountdown } from '../../../shared/utils/pktDate';

// Speed multipliers — 1x = 60s/Q, 1.5x = 40s/Q, 2x = 30s/Q
const TIME_MULTIPLIERS = [
  { label: 'Standard',  value: 1.0, sub: '1× · 60s / question', secsPerQ: 60 },
  { label: 'Fast',      value: 1.5, sub: '1.5× · 40s / question', secsPerQ: 40 },
  { label: 'Very Fast', value: 2.0, sub: '2× · 30s / question',  secsPerQ: 30 },
];

// Props are optional — when rendered directly as a route, `testId` comes
// from useParams. When the Course Player embeds this component to show a
// test resource inline, the parent passes `testId` (and optionally
// `returnTo`) as props so the page slots into the player's chrome without
// any duplicate top-level toggles. Component logic is otherwise identical.
const TestStartPage = ({ testId: propTestId, returnTo, embedded = false } = {}) => {
  const routeParams = useParams();
  const testId = propTestId || routeParams.testId;
  const navigate = useNavigate();
  const location = useLocation();

  const [test, setTest] = useState(null);
  // null = no preselection. Mode is only auto-set when the admin has locked
  // the test to a single mode, or when we're resuming an in-progress attempt
  // (which carries its own mode). On a fresh retake of a multi-mode test the
  // student MUST pick again — we don't silently inherit a previous attempt's
  // mode (that was the bug we're fixing here).
  const [selectedMode, setSelectedMode] = useState(null);
  const [timeMultiplier, setTimeMultiplier] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [existingAttempt, setExistingAttempt] = useState(null);
  // From GET /user-tests/active — just { completedAttempts }. maxAttempts is
  // sourced from the test summary endpoint (no second DB read on the server).
  const [completedAttempts, setCompletedAttempts] = useState(0);

  useEffect(() => {
    const stateData = location.state?.testData;

    const fetchTest = stateData
      // Came from AutoTestGenerator — test data already in navigation state, skip API call
      ? Promise.resolve({ data: { success: true, data: stateData } })
      // Direct navigation — fetch summary only (no MCQ objects, much lighter)
      : apiClient.get(`/tests/${testId}?summary=1`);

    // Check for in-progress attempt via targeted endpoint — does NOT load full history
    const fetchActive = apiClient.get(`/user-tests/active?testId=${testId}`);

    Promise.all([fetchTest, fetchActive])
      .then(([testRes, activeRes]) => {
        if (!testRes.data.success) throw new Error('Test not found');
        const t = testRes.data.data;
        setTest(t);

        const active = activeRes.data.data;
        if (active) {
          // Resume → carry over the in-progress attempt's mode (it can't change).
          setExistingAttempt(active);
          setSelectedMode(active.mode);
        } else {
          // Fresh attempt: only preselect when admin locks the test to a single mode.
          // When both modes are allowed, leave it null so the student must pick.
          const allowed = Array.isArray(t?.allowedModes) && t.allowedModes.length > 0
            ? t.allowedModes
            : ['tutor', 'timer'];
          if (allowed.length === 1) setSelectedMode(allowed[0]);
        }
        if (activeRes.data.attemptInfo?.completedAttempts != null) {
          setCompletedAttempts(activeRes.data.attemptInfo.completedAttempts);
        }
      })
      .catch(() => { toast.error('Test not found'); navigate('/student/tests'); })
      .finally(() => setLoading(false));
  }, [testId, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Page header (standalone route only) ───────────────────────────────────
  // Rules of Hooks: this MUST sit before any early return (the loading-state
  // spinner below) so the hook order stays identical between the loading and
  // loaded renders. Push title + Back into the dashboard's top navbar so the
  // body can start straight with the stat tiles. When `embedded` is true the
  // parent (Course Player) already owns the top bar — usePageHeader safely
  // no-ops when no PageHeaderProvider is in the tree.
  const headerAction = useMemo(() => (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
    >
      <FiArrowLeft className="w-4 h-4" /> Back
    </button>
  ), [navigate]);
  usePageHeader({
    title:    test?.title || 'Test',
    subtitle: test?.description || '',
    action:   headerAction,
  });

  // ── Availability status (PKT) ──────────────────────────────────────────
  // MUST live above the loading early-return below — same Rules-of-Hooks
  // reason as `headerAction`. The triple is safely undefined while
  // `test` is still loading; `resolveScheduleStatus` handles that
  // (treats missing `availability` as 'available'), so we just compute
  // it eagerly and ignore the result until the loaded render uses it.
  //
  // The setNowTick ticker re-evaluates the status every 60s so a locked
  // test flips to "available" without a manual page refresh once the
  // unlock time passes.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const scheduleStatus = useMemo(() => resolveScheduleStatus({
    availability: test?.availability,
    unlockAt:     test?.unlockAt,
    lockAt:       test?.lockAt,
  }), [test?.availability, test?.unlockAt, test?.lockAt]);
  const isLocked = scheduleStatus === 'locked';
  const isClosed = scheduleStatus === 'closed';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const totalQuestions = test?.totalQuestions || 0;
  const selectedMultiplier = TIME_MULTIPLIERS.find((m) => m.value === timeMultiplier);
  const calculatedDurationSec = selectedMode === 'timer'
    ? totalQuestions * (selectedMultiplier?.secsPerQ ?? 60)
    : null;
  const calculatedDurationMin = calculatedDurationSec ? Math.ceil(calculatedDurationSec / 60) : null;

  // Syllabus = subjects/chapters/topics from the test (auto-synced from MCQs)
  const syllabus = {
    subjects: test?.subjects?.filter(Boolean) || [],
    chapters: test?.chapters?.filter(Boolean) || [],
    topics:   test?.topics?.filter(Boolean)   || [],
  };
  const hasSyllabus = syllabus.subjects.length || syllabus.chapters.length || syllabus.topics.length;

  // Allowed modes drive whether the mode picker is shown. Single-entry array
  // ⇒ that mode is forced (picker hidden). Falls back to both for legacy tests.
  const allowedModes = Array.isArray(test?.allowedModes) && test.allowedModes.length > 0
    ? test.allowedModes
    : ['tutor', 'timer'];
  const modeLocked = allowedModes.length === 1;
  const lockedMode = modeLocked ? allowedModes[0] : null;

  // Attempt-limit derived state. maxAttempts comes from the test summary
  // we already loaded — NO extra server read for it. attemptsRemaining===0
  // means the student is locked out; Start is disabled. Resume of an
  // in-progress attempt is still allowed (already counted server-side).
  const maxAttempts       = test?.maxAttempts ?? null;
  const isUnlimited       = maxAttempts == null;
  const attemptsRemaining = isUnlimited ? null : Math.max(0, maxAttempts - completedAttempts);
  const limitReached      = !isUnlimited && attemptsRemaining === 0 && !existingAttempt;

  // Start is disabled when: starting / no questions / out of attempts / mode
  // not picked yet (multi-mode + fresh attempt) / test not in its window.
  // A resume of an in-progress attempt is still allowed even if the window
  // has since closed — matches the backend rule + the product decision.
  // (isLocked / isClosed come from the hooks above the loading early-return.)
  const startDisabled = starting
    || totalQuestions === 0
    || limitReached
    || (!modeLocked && !existingAttempt && !selectedMode)
    || ((isLocked || isClosed) && !existingAttempt);

  // When embedded inside the Course Player, `returnTo` carries the URL we
  // should land on after the student submits / pauses / exits the player.
  // Resolve(attemptId) is run AFTER we know the new attempt id so the course
  // route can deep-link to the result (?attempt=<id>).
  const buildPlayUrl = (attemptId) => {
    const base = `/student/tests/${testId}/play?attemptId=${attemptId}`;
    if (!returnTo) return base;
    // The caller may pass a template containing {attemptId} so it can encode
    // the new id into its own returnTo. If not present, append as ?attempt=.
    const resolvedReturn = returnTo.includes('{attemptId}')
      ? returnTo.replace('{attemptId}', attemptId)
      : `${returnTo}${returnTo.includes('?') ? '&' : '?'}attempt=${attemptId}`;
    return `${base}&returnTo=${encodeURIComponent(resolvedReturn)}`;
  };

  const handleStart = async () => {
    if (!selectedMode) {
      toast.info('Please select a test mode first.');
      return;
    }
    setStarting(true);
    try {
      const res = await apiClient.post('/user-tests/start', {
        testId,
        mode: selectedMode,
        totalDurationSec: calculatedDurationSec || null,
      });
      const attempt = res.data.data;
      navigate(buildPlayUrl(attempt._id), { state: { attemptData: attempt } });
    } catch (err) {
      if (err.response?.data?.attemptLimitReached) {
        setCompletedAttempts(err.response.data.usedAttempts ?? completedAttempts);
      }
      toast.error(err.response?.data?.message || 'Failed to start test');
    } finally {
      setStarting(false);
    }
  };

  // Resume: call start which returns the existing attempt with full MCQ data
  const handleResume = async () => {
    setStarting(true);
    try {
      const res = await apiClient.post('/user-tests/start', { testId, mode: existingAttempt.mode });
      const attempt = res.data.data;
      navigate(buildPlayUrl(attempt._id), { state: { attemptData: attempt } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resume test');
    } finally {
      setStarting(false);
    }
  };

  const diffTone = {
    Easy:   'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40',
    Medium: 'text-amber-700   bg-amber-50   dark:text-amber-300   dark:bg-amber-950/40',
    Hard:   'text-rose-700    bg-rose-50    dark:text-rose-300    dark:bg-rose-950/40',
  };

  // Difficulty + mode-locked chips. Surfaced inline above the stat tiles in
  // BOTH modes — standalone (navbar carries title only) and embedded (course
  // player top bar carries title only). Keeps the contextual signal visible
  // without re-rendering the test title in two places.
  const heroChips = (
    <div className="flex flex-wrap items-center gap-2">
      {test?.difficultyLevel && (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${diffTone[test.difficultyLevel] || diffTone.Medium}`}>
          <FiZap className="w-3 h-3" /> {test.difficultyLevel}
        </span>
      )}
      {modeLocked && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
          <FiLock className="w-3 h-3" /> {lockedMode === 'tutor' ? 'Tutor only' : 'Timed only'}
        </span>
      )}
    </div>
  );

  return (
    <div className={embedded ? 'space-y-4' : 'max-w-7xl mx-auto px-3 sm:px-6 space-y-4'}>
      {/* HERO — title was moved to the navbar (or course-player top bar), so
          this section now starts straight with the gradient strip and stat
          tiles. Tighter padding pulls the content closer to the top. */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
        {/* Brand gradient accent strip */}
        <div className="h-1.5 bg-brand-gradient" />

        <div className="p-4 sm:p-5">
          {(test?.difficultyLevel || modeLocked) && (
            <div className="mb-4">{heroChips}</div>
          )}

          {/* STAT TILES */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile Icon={FiList} label="Questions" value={totalQuestions || '—'} tone="orange" />
            <StatTile
              Icon={FiClock}
              label={selectedMode === 'timer' ? 'Total time' : 'Time'}
              value={selectedMode === 'timer' ? `${calculatedDurationMin}m` : 'Untimed'}
              tone="blue"
            />
            <StatTile Icon={FiTarget} label="Passing" value={`${test?.passingScore ?? 50}%`} tone="violet" />
            <StatTile
              Icon={FiRotateCcw}
              label="Attempts"
              value={isUnlimited ? '∞' : `${completedAttempts} / ${maxAttempts}`}
              valueClass={!isUnlimited && attemptsRemaining === 0 ? 'text-rose-500' : ''}
              tone="emerald"
            />
          </div>
        </div>
      </div>

      {/* RESUME BANNER — only when an in-progress attempt exists */}
      {existingAttempt && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex-shrink-0">
              <FiAlertCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-blue-900 dark:text-blue-200">
                You paused this test
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">
                {existingAttempt.answeredCount} of {existingAttempt.totalCount} answered ·
                <span className="capitalize"> {existingAttempt.mode}</span> mode
              </p>
            </div>
          </div>
          <button
            onClick={handleResume}
            disabled={starting}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            Resume attempt
          </button>
        </div>
      )}

      {/* AVAILABILITY BANNER — only when the test isn't currently open.
            • locked → not unlocked yet, show the unlock time + countdown.
            • closed → window has passed, show the close time. New attempts
              are blocked but past results / review (if also unlocked) stay
              accessible. */}
      {(isLocked || isClosed) && (
        <div className={`rounded-2xl p-4 sm:p-5 flex items-start gap-3 ${
          isLocked
            ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60'
            : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60'
        }`}>
          <div className={`w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 ${
            isLocked
              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300'
              : 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300'
          }`}>
            <FiLock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            {isLocked ? (
              <>
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  This test isn't open yet
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                  Opens {fmtCountdown(test?.unlockAt) || 'shortly'} · {fmtPktDateTime(test?.unlockAt)}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-rose-900 dark:text-rose-200">
                  This test is closed
                </p>
                <p className="text-sm text-rose-700 dark:text-rose-300 mt-0.5">
                  The window closed on {fmtPktDateTime(test?.lockAt)}. No new attempts can be started.
                  {existingAttempt && ' Your in-progress attempt can still be resumed.'}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* LIMIT REACHED BANNER */}
      {limitReached && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 flex-shrink-0">
            <FiLock className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-rose-900 dark:text-rose-200">
              You've used all attempts
            </p>
            <p className="text-sm text-rose-700 dark:text-rose-300 mt-0.5">
              You've completed all {maxAttempts} allowed attempts for this test.
            </p>
          </div>
        </div>
      )}

      {/* MAIN GRID — mode/instructions on the left, syllabus/attempts/tips on the right */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-5">
          {/* MODE SELECTOR — hidden when resuming (mode is fixed to the in-progress attempt's mode) */}
          {!existingAttempt && (
            <SectionCard
              icon={<FiAward className="w-4 h-4" />}
              title="Test mode"
              subtitle={modeLocked
                ? 'Set by the test creator — locked for this test.'
                : 'Pick how you want to take this test.'}
            >
              {modeLocked ? (
                <ModeCard mode={lockedMode} selected locked onClick={() => {}} />
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  <ModeCard
                    mode="tutor"
                    selected={selectedMode === 'tutor'}
                    onClick={() => setSelectedMode('tutor')}
                  />
                  <ModeCard
                    mode="timer"
                    selected={selectedMode === 'timer'}
                    onClick={() => setSelectedMode('timer')}
                  />
                </div>
              )}

              {/* Time multiplier — only when timer mode is selected/locked */}
              {selectedMode === 'timer' && (
                <div className="mt-5 pt-5 border-t border-[var(--border)]">
                  <p className="text-sm font-semibold text-[var(--text-strong)] mb-3 flex items-center gap-2">
                    <FiClock className="w-4 h-4 text-primary-500" /> Time allocation
                  </p>
                  <div className="grid sm:grid-cols-3 gap-2.5">
                    {TIME_MULTIPLIERS.map((opt) => {
                      const isActive = timeMultiplier === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setTimeMultiplier(opt.value)}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            isActive
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                              : 'border-[var(--border)] hover:border-primary-300 dark:hover:border-primary-700'
                          }`}
                        >
                          <p className="text-sm font-bold text-[var(--text-strong)]">{opt.label}</p>
                          <p className="text-[11px] text-[var(--text-faint)] mt-0.5">{opt.sub}</p>
                        </button>
                      );
                    })}
                  </div>
                  {totalQuestions > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/30 rounded-xl px-4 py-2.5">
                      <FiClock className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Total time: <strong>{calculatedDurationMin} min</strong>
                        {' '}({totalQuestions} × {selectedMultiplier?.secsPerQ ?? 60}s each)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          )}

          {/* DESKTOP ACTION BAR — sits directly below the mode card so the CTA
              is in the natural reading flow. Mobile gets the sticky bottom bar. */}
          <div className="hidden lg:flex items-center justify-end gap-2">
            {existingAttempt && (
              <button
                onClick={handleResume}
                disabled={starting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300 font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-50 transition-colors"
              >
                <FiPlayCircle className="w-5 h-5" /> Resume
              </button>
            )}
            <button
              onClick={handleStart}
              disabled={startDisabled}
              className="btn-brand text-base px-6 py-2.5"
            >
              {starting
                ? <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <FiPlayCircle className="w-5 h-5" />}
              {starting ? 'Starting…' : existingAttempt ? 'Start Fresh' : 'Start Test'}
            </button>
          </div>

          {/* INSTRUCTIONS */}
          {test?.instructions && (
            <SectionCard icon={<FiInfo className="w-4 h-4" />} title="Instructions">
              <p className="text-sm text-[var(--text-muted)] leading-relaxed whitespace-pre-line">
                {test.instructions}
              </p>
            </SectionCard>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          {/* SYLLABUS */}
          {hasSyllabus ? (
            <SectionCard
              icon={<FiBookOpen className="w-4 h-4" />}
              title="Test syllabus"
              subtitle="Auto-synced from this test's questions."
            >
              <div className="space-y-3">
                {syllabus.subjects.length > 0 && (
                  <SyllabusRow label="Subjects" items={syllabus.subjects} tone="blue" />
                )}
                {syllabus.chapters.length > 0 && (
                  <SyllabusRow label="Chapters" items={syllabus.chapters} tone="violet" />
                )}
                {syllabus.topics.length > 0 && (
                  <SyllabusRow label="Topics" items={syllabus.topics} tone="emerald" />
                )}
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>

      {/* STICKY MOBILE ACTION BAR */}
      <div className="lg:hidden sticky bottom-0 -mx-3 sm:-mx-6 px-3 sm:px-6 py-3 bg-[var(--bg-surface)]/95 backdrop-blur border-t border-[var(--border)] flex gap-2 z-10">
        {existingAttempt && (
          <button
            onClick={handleResume}
            disabled={starting}
            className="flex-1 py-3 rounded-xl border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300 font-semibold disabled:opacity-50"
          >
            Resume
          </button>
        )}
        <button
          onClick={handleStart}
          disabled={startDisabled}
          className="btn-brand flex-1 py-3 text-base"
        >
          {starting
            ? <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <FiPlayCircle className="w-5 h-5" />}
          {starting ? 'Starting…' : existingAttempt ? 'Start fresh' : 'Start test'}
        </button>
      </div>

      {totalQuestions === 0 && (
        <p className="text-center text-sm text-rose-500">This test has no questions yet.</p>
      )}
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────────

const StatTile = ({ Icon, label, value, tone = 'orange', valueClass = '' }) => {
  const TONES = {
    orange:  'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300',
    blue:    'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
    violet:  'bg-secondary-50 text-secondary-600 dark:bg-secondary-950/40 dark:text-secondary-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  };
  return (
    <div className="bg-[var(--bg-muted)] rounded-xl border border-[var(--border)] p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${TONES[tone]}`}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">{label}</div>
        <div className={`text-base sm:text-lg font-bold text-[var(--text-strong)] leading-tight truncate ${valueClass}`}>{value}</div>
      </div>
    </div>
  );
};

const SectionCard = ({ icon, title, subtitle, children }) => (
  <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6">
    <header className="mb-4">
      <h2 className="text-sm font-semibold text-[var(--text-strong)] flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-300 flex items-center justify-center">
          {icon}
        </span>
        {title}
      </h2>
      {subtitle && <p className="text-xs text-[var(--text-faint)] mt-1 ml-8">{subtitle}</p>}
    </header>
    {children}
  </section>
);

const MODE_META = {
  tutor: {
    emoji: '🎓',
    title: 'Tutor mode',
    sub: 'Instant feedback and explanation after each answer.',
  },
  timer: {
    emoji: '⏱️',
    title: 'Timed mode',
    sub: 'Complete within the time limit — results shown at the end.',
  },
};

const ModeCard = ({ mode, selected, locked, onClick }) => {
  const m = MODE_META[mode];
  return (
    <button
      onClick={onClick}
      disabled={locked}
      type="button"
      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
        selected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
          : 'border-[var(--border)] hover:border-primary-300 dark:hover:border-primary-700'
      } ${locked ? 'cursor-default' : ''}`}
    >
      {selected && !locked && (
        <FiCheckCircle className="absolute top-3 right-3 w-5 h-5 text-primary-500" />
      )}
      {locked && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-950/50 px-2 py-0.5 rounded-full">
          <FiLock className="w-3 h-3" /> Locked
        </span>
      )}
      <div className="text-2xl mb-1.5">{m.emoji}</div>
      <h3 className="font-semibold text-[var(--text-strong)]">{m.title}</h3>
      <p className="text-xs text-[var(--text-muted)] mt-1">{m.sub}</p>
    </button>
  );
};

const SYLLABUS_TONES = {
  blue:    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60',
  violet:  'bg-secondary-50 text-secondary-700 border-secondary-200 dark:bg-secondary-950/40 dark:text-secondary-300 dark:border-secondary-900/60',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
};

const SyllabusRow = ({ label, items, tone }) => (
  <div>
    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)] mb-1.5">{label}</p>
    <div className="flex flex-wrap gap-1.5">
      {items.map((v) => (
        <span key={v} className={`px-2.5 py-1 text-xs font-medium rounded-full border ${SYLLABUS_TONES[tone]}`}>
          {v}
        </span>
      ))}
    </div>
  </div>
);

export default TestStartPage;
