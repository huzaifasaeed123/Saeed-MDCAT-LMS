// src/modules/tests/pages/TestPlayerPage.jsx
//
// SKN Academy LMS — Test Player.
//
// One component serves THREE modes (detected per-request):
//   • tutor   — live attempt; user picks → sees correct answer + explanation
//   • timer   — live attempt; countdown clock; feedback only at submit
//   • review  — completed attempt; read-only; sees correct/incorrect on every
//               question. Mark-for-review and Report still work (persisted to
//               the backend) so students can flag questions while reviewing.
//
// Mode detection:
//   • URL path contains "/review/"  → review mode  (uses :attemptId param)
//   • Otherwise                     → live  mode  (uses ?attemptId query)
//   • `attempt.mode` differentiates tutor vs timer in live mode.
//
// Time tracking:
//   • Timer mode  → `totalDurationSec − timeLeft` (precise budget math).
//   • Tutor mode  → wall-clock from `playStartRef` + any prior pause time.
//   • Review mode → no tracking; the attempt's stored time is displayed.
//
// Layout matches the design screenshot:
//   • Sticky top bar  → exit · mode badge · title · progress · timer · pause · submit
//   • Main column    → subject/chapter/topic chips · mark/report · question
//                       · options · tutor-feedback panel · prev/next
//   • Right sidebar  → question palette grid + legend + live stats + jump button
//                       (drawer on mobile)
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  useParams, useSearchParams, useNavigate, useLocation,
} from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiChevronLeft, FiChevronRight, FiX, FiCheck, FiSend, FiPause, FiClock,
  FiArrowLeft, FiZap, FiFlag, FiBookmark, FiBarChart2, FiEye, FiGrid,
  FiBookOpen, FiFileText, FiSun, FiMoon, FiLogOut,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { fixImageUrls } from '../../../shared/utils/fixImageUrls';
import useTheme from '../../../core/theme/useTheme';

const REPORT_REASONS = [
  'Question Statement Wrong',
  'Option Wrong',
  'Answer Key is Incorrect',
  'Wrong Explanation',
  'Need Explanation',
];

// ── Tiny helpers ────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const formatHMS = (totalSec) => {
  if (!totalSec && totalSec !== 0) return '—';
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${pad(m)}:${pad(sec)}`;
};
const formatShortTime = (s) => {
  if (!s && s !== 0) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m}m`;
  return `${m}m ${sec}s`;
};

// ── Mode badge — pill near the page title. ─────────────────────────────────
const ModeBadge = ({ mode, isReview }) => {
  const meta = isReview
    ? { label: 'Review', cls: 'bg-secondary-50 text-secondary-700 dark:bg-secondary-950/40 dark:text-secondary-300', Icon: FiEye }
    : mode === 'tutor'
      ? { label: 'Tutor',  cls: 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300',         Icon: FiZap }
      : { label: 'Timed',  cls: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',                     Icon: FiClock };
  const Icon = meta.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.cls}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
};

// ── Timer pill — two render modes:
//   • timer: `5:30 / 48:00` (elapsed / total). Auto-submit happens when
//     elapsed reaches total. Turns rose-red + pulses in the last 60s.
//   • tutor: `5:30` (elapsed only — no budget).
const TimerPill = ({ usedSec, totalSec, mode }) => {
  const isTimer = mode === 'timer';
  const remaining = isTimer ? Math.max(0, (totalSec || 0) - (usedSec || 0)) : null;
  const isLow = isTimer && remaining <= 60;
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
      isLow
        ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/30'
        : 'border-primary-200 dark:border-primary-900/50 bg-primary-50/60 dark:bg-primary-950/30'
    }`}>
      <FiClock className={`w-4 h-4 ${isLow ? 'text-rose-500' : 'text-primary-600 dark:text-primary-300'}`} />
      <span className={`font-mono text-sm sm:text-base font-bold tabular-nums ${isLow ? 'text-rose-600 dark:text-rose-300 animate-pulse' : 'text-primary-700 dark:text-primary-300'}`}>
        {formatHMS(usedSec || 0)}
        {isTimer && (
          <span className="font-mono text-[11px] text-[var(--text-faint)] font-normal ml-0.5">
            {' / '}{formatHMS(totalSec || 0)}
          </span>
        )}
      </span>
    </div>
  );
};

// ── Report Modal ────────────────────────────────────────────────────────────
const ReportModal = ({ onSubmit, onClose, submitting }) => {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-md p-5 border border-[var(--border)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[var(--text-strong)]">Report a question</h3>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-strong)]">
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--text)] mb-2">Reason</label>
          <div className="space-y-1.5">
            {REPORT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-[var(--bg-muted)]">
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-primary-500"
                />
                <span className="text-sm text-[var(--text)]">{r}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="mb-5">
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Details (optional)</label>
          <textarea
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Describe the issue…"
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-primary-400/40 resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm py-2">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(reason, details)}
            disabled={!reason || submitting}
            className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {submitting ? <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-white" /> : <FiSend className="w-4 h-4" />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Submit-confirm Modal ────────────────────────────────────────────────────
// Themed replacement for the native confirm() that used to fire on exit.
// Visually mirrors SubmitConfirmModal so the test player has one consistent
// modal style. The "Exit" button calls the same pause API as the Pause
// button so the attempt is saved exactly the same way before navigating.
const ExitConfirmModal = ({ onConfirm, onCancel, exiting }) => (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-sm p-5 text-center border border-[var(--border)]">
      <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 flex items-center justify-center">
        <FiLogOut className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-display font-bold text-[var(--text-strong)] mb-1">Exit the test?</h3>
      <p className="text-sm text-[var(--text-muted)] mb-5">
        Your progress will be saved so you can resume from Test History.
      </p>
      <div className="flex gap-3">
        <button onClick={onCancel} disabled={exiting} className="btn-ghost flex-1 text-sm py-2 disabled:opacity-50">Cancel</button>
        <button
          onClick={onConfirm}
          disabled={exiting}
          className="btn-brand flex-1 text-sm py-2"
        >
          {exiting && <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-white" />}
          {exiting ? 'Saving…' : 'Save & exit'}
        </button>
      </div>
    </div>
  </div>
);

const SubmitConfirmModal = ({ unanswered, onConfirm, onCancel, submitting }) => (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-sm p-5 text-center border border-[var(--border)]">
      <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-300 flex items-center justify-center">
        <FiFileText className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-display font-bold text-[var(--text-strong)] mb-1">Submit test?</h3>
      {unanswered > 0 ? (
        <p className="text-sm text-amber-600 dark:text-amber-300 mb-5">
          You have <strong>{unanswered}</strong> unanswered question{unanswered > 1 ? 's' : ''}. Submit anyway?
        </p>
      ) : (
        <p className="text-sm text-[var(--text-muted)] mb-5">All questions answered. Ready to submit?</p>
      )}
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-ghost flex-1 text-sm py-2">Cancel</button>
        <button
          onClick={onConfirm}
          disabled={submitting}
          className="btn-brand flex-1 text-sm py-2"
        >
          {submitting && <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-white" />}
          Yes, submit
        </button>
      </div>
    </div>
  </div>
);

// ── Question Palette (right sidebar) ────────────────────────────────────────
// Renders the 8-col grid + legend + live stats + jump button.
// Cell color rules (current wins over everything):
//   - current question      → solid orange fill (primary brand)
//   - marked for review     → amber fill
//   - tutor/review: correct → green fill,  incorrect → rose fill
//   - timer mode: answered  → blue fill,  unattempted → muted bg
const PaletteCell = ({ qa, index, isCurrent, answered, mode, isReview }) => {
  const reveal = isReview || mode === 'tutor';
  const isMarked = qa.markedForReview;

  let bg;
  if (isCurrent) {
    // Solid brand-orange fill so the active question is the most prominent
    // cell in the grid — no ambiguity about which one you're on.
    bg = 'bg-primary-500 text-white border-transparent shadow-sm';
  } else if (isMarked) {
    bg = 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 border-transparent';
  } else if (reveal && answered) {
    bg = qa.isCorrect
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 border-transparent'
      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 border-transparent';
  } else if (answered) {
    // timer mode during the test — we don't reveal correctness; just show "answered"
    bg = 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200 border-transparent';
  } else {
    bg = 'bg-[var(--bg-muted)] text-[var(--text-muted)] border-transparent';
  }

  return (
    <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center text-xs font-bold tabular-nums transition-all ${bg}`}>
      {index + 1}
    </span>
  );
};

const QuestionPalette = ({
  qas, currentIndex, mode, isReview, localAnswers, onNavigate, onJumpUnanswered, onClose, attempt,
}) => {
  const reveal = isReview || mode === 'tutor';
  const answeredCount = qas.filter((_, i) => localAnswers[i] != null || qas[i].selectedOption).length;
  const correctCount  = reveal ? qas.filter((q) => q.isCorrect).length : null;
  const incorrectCount = reveal
    ? qas.filter((q) => (q.selectedOption || localAnswers[qas.indexOf(q)]) && !q.isCorrect).length
    : null;
  const markedCount   = qas.filter((q) => q.markedForReview).length;
  const unattempted   = qas.length - answeredCount;

  // Live stats — only meaningful in tutor / review (need correctness signal)
  const avgPerQ = useMemo(() => {
    const totalT = attempt?.totalTimeSpent || 0;
    if (totalT === 0 || answeredCount === 0) return null;
    return Math.round(totalT / Math.max(1, answeredCount));
  }, [attempt?.totalTimeSpent, answeredCount]);

  const accuracy = reveal && answeredCount > 0
    ? Math.round(((correctCount || 0) / answeredCount) * 100)
    : null;

  // Pace — in timer mode, on-track when remaining time per remaining Q ≈ time so far per answered Q
  const pace = useMemo(() => {
    if (!attempt) return null;
    if (mode !== 'timer' || !attempt.totalDurationSec) return null;
    const remaining = qas.length - answeredCount;
    if (remaining === 0) return 'Done';
    const timeUsed = attempt.totalTimeSpent || 0;
    const budget = attempt.totalDurationSec;
    const usedRatio = timeUsed / budget;
    const answeredRatio = answeredCount / qas.length;
    const diff = answeredRatio - usedRatio;
    if (diff >= 0.05) return 'Ahead';
    if (diff <= -0.05) return 'Behind';
    return 'On track';
  }, [mode, qas.length, answeredCount, attempt]);

  return (
    <aside className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 flex flex-col gap-4 h-full max-h-full overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)]">Question palette</p>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-[var(--text-faint)] hover:text-[var(--text-strong)]">
            <FiX className="w-4 h-4" />
          </button>
        )}
      </div>

      <div>
        <p className="font-display text-xl font-extrabold text-[var(--text-strong)] leading-none">
          {answeredCount}
          <span className="text-sm font-normal text-[var(--text-faint)]"> / {qas.length} answered</span>
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-8 gap-1.5 sm:gap-2">
        {qas.map((qa, i) => (
          <button
            key={i}
            onClick={() => onNavigate(i)}
            className="appearance-none"
            aria-label={`Go to question ${i + 1}`}
          >
            <PaletteCell
              qa={qa}
              index={i}
              isCurrent={i === currentIndex}
              answered={localAnswers[i] != null || !!qa.selectedOption}
              mode={mode}
              isReview={isReview}
            />
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <LegendRow swatch="bg-primary-500" label="Current" count={1} />
        {reveal && <LegendRow swatch="bg-emerald-200 dark:bg-emerald-900/60" label="Correct" count={correctCount || 0} />}
        {reveal && <LegendRow swatch="bg-rose-200 dark:bg-rose-900/60" label="Incorrect" count={incorrectCount || 0} />}
        {!reveal && <LegendRow swatch="bg-blue-200 dark:bg-blue-900/60" label="Answered" count={answeredCount} />}
        <LegendRow swatch="bg-amber-200 dark:bg-amber-900/60" label="Marked" count={markedCount} />
        <LegendRow swatch="bg-[var(--bg-muted)]" label="Unattempted" count={unattempted} />
      </div>

      {/* Live stats */}
      <div className="pt-3 border-t border-[var(--border)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)] mb-2">Live stats</p>
        <div className="space-y-1.5 text-sm">
          {accuracy != null && (
            <StatRow label="Accuracy so far" value={`${accuracy}%`} valueCls="text-emerald-600 dark:text-emerald-300" />
          )}
          <StatRow label="Avg time / Q" value={avgPerQ != null ? formatShortTime(avgPerQ) : '—'} />
          {pace && (
            <StatRow
              label="Pace"
              value={pace}
              valueCls={pace === 'Ahead' ? 'text-emerald-600 dark:text-emerald-300'
                : pace === 'Behind' ? 'text-rose-600 dark:text-rose-300'
                : 'text-[var(--text-strong)]'}
            />
          )}
        </div>
      </div>

      {/* Jump to unanswered */}
      {!isReview && unattempted > 0 && (
        <button
          onClick={onJumpUnanswered}
          className="mt-auto inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
        >
          <FiGrid className="w-4 h-4" /> Jump to unanswered
        </button>
      )}
    </aside>
  );
};

const LegendRow = ({ swatch, label, count }) => (
  <div className="flex items-center gap-1.5">
    <span className={`w-3 h-3 rounded ${swatch} flex-shrink-0`} />
    <span className="text-[var(--text-muted)] truncate flex-1">{label}</span>
    <span className="text-[var(--text-strong)] font-bold tabular-nums">{count}</span>
  </div>
);

const StatRow = ({ label, value, valueCls }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-[var(--text-muted)]">{label}</span>
    <span className={`font-bold tabular-nums ${valueCls || 'text-[var(--text-strong)]'}`}>{value}</span>
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────
const TestPlayerPage = () => {
  const { testId, attemptId: paramAttemptId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryAttemptId = searchParams.get('attemptId');
  const attemptId      = paramAttemptId || queryAttemptId;
  // Path-based mode detection — /review/:attemptId triggers read-only mode.
  const isReview       = location.pathname.includes('/review/');

  const [attempt, setAttempt]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Local per-question state (avoids API call per click in live mode).
  const [localAnswers, setLocalAnswers]               = useState({});
  const [localMarks, setLocalMarks]                   = useState({});
  const [tutorFeedback, setTutorFeedback]             = useState({});
  const [localCorrectOptions, setLocalCorrectOptions] = useState({});

  const [timeLeft, setTimeLeft]                       = useState(null);
  const [totalDurationSec, setTotalDurationSec]       = useState(null);
  // Live elapsed seconds for the top-bar timer pill. Tutor mode = pure
  // wall-clock counting up; timer mode = `totalDurationSec - timeLeft` is
  // already exact, but we keep elapsedSec in sync so the pill re-renders
  // every second without remounting the whole page.
  const [elapsedSec, setElapsedSec]                   = useState(0);

  const [showPalette, setShowPalette]                 = useState(false);  // mobile drawer
  const [showReport, setShowReport]                   = useState(false);
  const [reportSubmitting, setReportSubmitting]      = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm]    = useState(false);
  const [showExitConfirm,   setShowExitConfirm]      = useState(false);
  const [submitting, setSubmitting]                   = useState(false);
  const [pausing, setPausing]                         = useState(false);
  const [exiting, setExiting]                         = useState(false);

  // Wall-clock tracking — used in both tutor and timer modes; ignored in review.
  const playStartRef     = useRef(null);
  const baseTimeSpentRef = useRef(0);

  // Theme toggle for the in-test light/dark switch in the top bar.
  const { theme, toggle: toggleTheme } = useTheme();

  // ── Load attempt ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!attemptId) {
      navigate(`/student/tests/${testId}`);
      return;
    }
    const fetchAttempt = async () => {
      try {
        // Live flow may pre-load via navigation state to skip a round-trip.
        const stateAttempt = location.state?.attemptData;
        const res = stateAttempt
          ? { data: { data: stateAttempt } }
          : await apiClient.get(`/user-tests/${attemptId}`);
        const a = res.data.data;

        // Mode-vs-status sanity:
        // - Review URL but attempt is in-progress → route to live play.
        // - Live URL but attempt is completed     → route to result.
        if (isReview && a.status === 'in-progress') {
          navigate(`/student/tests/${testId}/play?attemptId=${attemptId}`, { state: { attemptData: a } });
          return;
        }
        if (!isReview && a.status === 'completed') {
          navigate(`/student/tests/${testId}/result/${attemptId}`);
          return;
        }

        setAttempt(a);
        setCurrentIndex(a.currentQuestionIndex || 0);

        // Hydrate local state from server snapshot
        const answers = {}, marks = {}, feedback = {}, correctOpts = {};
        a.questionAttempts.forEach((qa, i) => {
          if (qa.correctOption) correctOpts[i] = qa.correctOption;
          if (qa.selectedOption) answers[i] = qa.selectedOption;
          if (qa.markedForReview) marks[i] = true;
          // In tutor mode (and always in review), pre-fill feedback for already-answered Qs
          if (qa.selectedOption && (a.mode === 'tutor' || isReview)) {
            feedback[i] = { isCorrect: qa.isCorrect };
          }
        });
        setLocalAnswers(answers);
        setLocalMarks(marks);
        setTutorFeedback(feedback);
        setLocalCorrectOptions(correctOpts);

        // Time setup — only relevant for live timer mode
        if (!isReview && a.mode === 'timer') {
          const totalQ   = a.questionAttempts?.length || 0;
          const totalSec = a.totalDurationSec || totalQ * 60;
          const timeUsed = a.totalTimeSpent > 0
            ? a.totalTimeSpent
            : Math.floor((Date.now() - new Date(a.startTime).getTime()) / 1000);
          setTotalDurationSec(totalSec);
          setTimeLeft(Math.max(0, totalSec - timeUsed));
        }

        // Start wall-clock for live modes only
        if (!isReview) {
          playStartRef.current     = Date.now();
          baseTimeSpentRef.current = a.totalTimeSpent || 0;
        }
      } catch {
        toast.error('Failed to load test');
        navigate(`/student/tests/${testId}`);
      } finally {
        setLoading(false);
      }
    };
    fetchAttempt();
  }, [attemptId, testId, navigate, isReview]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live timer countdown (timer mode only) ──────────────────────────────
  useEffect(() => {
    if (isReview || timeLeft === null || attempt?.mode !== 'timer') return;
    if (timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { handleSubmitTest(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timeLeft, attempt?.mode, isReview]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Elapsed-seconds ticker (both tutor + timer) ─────────────────────────
  // Drives the top-bar timer pill. In tutor mode this IS the displayed
  // value; in timer mode the pill computes `total − elapsed` for the
  // countdown half but we keep elapsedSec live so the format is uniform.
  useEffect(() => {
    if (isReview || !attempt) return;
    const tick = () => {
      const base    = baseTimeSpentRef.current || 0;
      const session = playStartRef.current
        ? Math.floor((Date.now() - playStartRef.current) / 1000)
        : 0;
      setElapsedSec(base + session);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [attempt, isReview]);

  // ── Navigation ──────────────────────────────────────────────────────────
  const goToQuestion = useCallback((newIdx) => {
    if (!attempt || newIdx < 0 || newIdx >= attempt.questionAttempts.length) return;
    setCurrentIndex(newIdx);
    setShowPalette(false);
  }, [attempt]);

  const jumpToNextUnanswered = useCallback(() => {
    if (!attempt) return;
    const qas = attempt.questionAttempts;
    // Try from current+1 wrapping around
    for (let i = 1; i <= qas.length; i++) {
      const idx = (currentIndex + i) % qas.length;
      if (localAnswers[idx] == null && !qas[idx].selectedOption) {
        setCurrentIndex(idx);
        setShowPalette(false);
        return;
      }
    }
  }, [attempt, currentIndex, localAnswers]);

  // ── Select option ───────────────────────────────────────────────────────
  const handleSelectOption = (optionLetter) => {
    if (isReview) return;            // read-only
    if (!attempt) return;
    const mode = attempt.mode;
    // In tutor mode, lock answer once feedback shown
    if (mode === 'tutor' && tutorFeedback[currentIndex] !== undefined) return;

    setLocalAnswers((prev) => ({ ...prev, [currentIndex]: optionLetter }));

    if (mode === 'tutor') {
      const correctOpt = localCorrectOptions[currentIndex];
      if (correctOpt) {
        const isCorrect = optionLetter === correctOpt;
        setTutorFeedback((prev) => ({ ...prev, [currentIndex]: { isCorrect } }));
        setAttempt((prev) => {
          if (!prev) return prev;
          const qa = [...prev.questionAttempts];
          qa[currentIndex] = { ...qa[currentIndex], selectedOption: optionLetter, isCorrect };
          return { ...prev, questionAttempts: qa };
        });
      } else {
        // Legacy fallback — server-side correctness check
        apiClient.put(`/user-tests/${attemptId}/question/${currentIndex}`, { selectedOption: optionLetter })
          .then((res) => {
            const { isCorrect } = res.data.data;
            setTutorFeedback((prev) => ({ ...prev, [currentIndex]: { isCorrect } }));
            setAttempt((prev) => {
              if (!prev) return prev;
              const qa = [...prev.questionAttempts];
              qa[currentIndex] = { ...qa[currentIndex], selectedOption: optionLetter, isCorrect };
              return { ...prev, questionAttempts: qa };
            });
          })
          .catch(() => toast.error('Failed to save answer'));
      }
    }
    // Timer mode: purely local — submitted in batch at completeTest
  };

  // ── Mark for review ─────────────────────────────────────────────────────
  // Live modes: local only (persisted with the batch submit).
  // Review mode: persist immediately via the dedicated endpoint.
  const handleToggleMark = async () => {
    const newVal = !localMarks[currentIndex];
    setLocalMarks((prev) => ({ ...prev, [currentIndex]: newVal }));
    setAttempt((prev) => {
      if (!prev) return prev;
      const qa = [...prev.questionAttempts];
      qa[currentIndex] = { ...qa[currentIndex], markedForReview: newVal };
      return { ...prev, questionAttempts: qa };
    });
    if (isReview) {
      try {
        await apiClient.put(`/user-tests/${attemptId}/mark/${currentIndex}`);
      } catch {
        // Roll back optimistic update
        setLocalMarks((prev) => ({ ...prev, [currentIndex]: !newVal }));
        toast.error('Could not update mark');
      }
    }
  };

  // ── Report (modal) ──────────────────────────────────────────────────────
  const handleReport = async (reason, details) => {
    setReportSubmitting(true);
    try {
      const mcqId = attempt.questionAttempts[currentIndex]?.mcqId?._id;
      await apiClient.post('/mcq-reports', {
        mcqId,
        testId: attempt.test?._id || attempt.test,
        attemptId,
        questionIndex: currentIndex,
        reason,
        details,
      });
      toast.success('Report submitted');
      setShowReport(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit report');
    } finally {
      setReportSubmitting(false);
    }
  };

  // ── Submit test ─────────────────────────────────────────────────────────
  const handleSubmitTest = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setShowSubmitConfirm(false);

    const answers = attempt?.questionAttempts.map((_, i) => ({
      questionIndex:   i,
      selectedOption:  localAnswers[i] ?? null,
      markedForReview: localMarks[i]   ?? false,
    })) ?? [];

    const wallClockSec = playStartRef.current
      ? Math.floor((Date.now() - playStartRef.current) / 1000)
      : 0;
    const totalTimeSpent = attempt?.mode === 'timer' && totalDurationSec
      ? totalDurationSec - (timeLeft ?? 0)
      : Math.max(0, baseTimeSpentRef.current + wallClockSec);

    try {
      await apiClient.put(`/user-tests/${attemptId}/complete`, { answers, totalTimeSpent });
      navigate(`/student/tests/${testId}/result/${attemptId}`);
    } catch {
      toast.error('Failed to submit test');
      setSubmitting(false);
    }
  }, [submitting, attempt, localAnswers, localMarks, attemptId, testId, navigate, totalDurationSec, timeLeft]);

  // ── Pause test ──────────────────────────────────────────────────────────
  const handlePauseTest = useCallback(async () => {
    if (pausing || submitting) return;
    setPausing(true);
    const answers = attempt?.questionAttempts.map((_, i) => ({
      questionIndex:   i,
      selectedOption:  localAnswers[i] ?? null,
      markedForReview: localMarks[i]   ?? false,
    })) ?? [];
    const wallClockSec = playStartRef.current
      ? Math.floor((Date.now() - playStartRef.current) / 1000)
      : 0;
    const timeSpent = attempt?.mode === 'timer' && totalDurationSec !== null
      ? totalDurationSec - (timeLeft ?? 0)
      : Math.max(0, baseTimeSpentRef.current + wallClockSec);

    try {
      await apiClient.put(`/user-tests/${attemptId}/pause`, {
        answers,
        currentQuestionIndex: currentIndex,
        timeSpent,
      });
      toast.success('Test paused — progress saved');
      navigate(`/student/tests/${testId}`);
    } catch {
      toast.error('Failed to pause test');
      setPausing(false);
    }
  }, [pausing, submitting, attempt, localAnswers, localMarks, attemptId, testId, navigate, currentIndex, totalDurationSec, timeLeft]);

  // ── Keyboard shortcuts: arrows + A/B/C/D ────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (showReport || showSubmitConfirm) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); goToQuestion(currentIndex + 1); return; }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goToQuestion(currentIndex - 1); return; }
      // A/B/C/D quick-select (live only — review is read-only)
      if (!isReview && /^[a-dA-D]$/.test(e.key)) {
        const letter = e.key.toUpperCase();
        const opts = attempt?.questionAttempts[currentIndex]?.mcqId?.options || [];
        if (opts.some((o) => o.optionLetter === letter)) {
          e.preventDefault();
          handleSelectOption(letter);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIndex, goToQuestion, showReport, showSubmitConfirm, isReview, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Exit handlers ───────────────────────────────────────────────────────
  const handleExit = () => {
    if (isReview) {
      navigate(`/student/tests/${testId}/result/${attemptId}`);
    } else {
      // Show themed confirm modal — actual save+navigate is in handleConfirmExit.
      setShowExitConfirm(true);
    }
  };

  // Save the attempt (same payload as pause) and then navigate away. Using the
  // exact same /pause endpoint means an exit and a pause produce identical
  // history entries, so the student can resume from Test History either way.
  const handleConfirmExit = useCallback(async () => {
    if (exiting) return;
    setExiting(true);
    const answers = attempt?.questionAttempts.map((_, i) => ({
      questionIndex:   i,
      selectedOption:  localAnswers[i] ?? null,
      markedForReview: localMarks[i]   ?? false,
    })) ?? [];
    const wallClockSec = playStartRef.current
      ? Math.floor((Date.now() - playStartRef.current) / 1000)
      : 0;
    const timeSpent = attempt?.mode === 'timer' && totalDurationSec !== null
      ? totalDurationSec - (timeLeft ?? 0)
      : Math.max(0, baseTimeSpentRef.current + wallClockSec);

    try {
      await apiClient.put(`/user-tests/${attemptId}/pause`, {
        answers,
        currentQuestionIndex: currentIndex,
        timeSpent,
      });
      navigate(`/student/tests/${testId}`);
    } catch {
      toast.error('Failed to save progress');
      setExiting(false);
      setShowExitConfirm(false);
    }
  }, [exiting, attempt, localAnswers, localMarks, attemptId, testId, navigate, currentIndex, totalDurationSec, timeLeft]);

  // ── Hooks BEFORE any early return (Rules of Hooks) ─────────────────────
  // Optional chaining makes these safe even before `attempt` loads — the
  // useMemo just returns null on the first render and re-runs when the
  // attempt arrives.
  const currentMcq = attempt?.questionAttempts?.[currentIndex]?.mcqId;
  const communityPct = useMemo(() => {
    const s = currentMcq?.statistics;
    if (!s || !s.totalAnswered) return null;
    return Math.round((s.totalCorrect / s.totalAnswered) * 100);
  }, [currentMcq]);

  // ── Loading / not-found ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }
  if (!attempt) return null;

  const qas              = attempt.questionAttempts;
  const currentQA        = qas[currentIndex];
  const mode             = attempt.mode;
  const hasFeedback      = isReview ? !!currentQA?.selectedOption : tutorFeedback[currentIndex] !== undefined;
  const correctOptLetter = localCorrectOptions[currentIndex] ?? currentMcq?.options?.find((o) => o.isCorrect)?.optionLetter;
  const totalUnanswered  = qas.filter((_, i) => !localAnswers[i] && !qas[i].selectedOption).length;
  const totalAnswered    = qas.length - totalUnanswered;
  const progressPct      = qas.length > 0 ? Math.round((totalAnswered / qas.length) * 100) : 0;
  const subjectChip      = currentMcq?.subject;
  const chapterChip      = currentMcq?.unit;
  const topicChip        = currentMcq?.topic;
  const userAnswer       = isReview ? currentQA?.selectedOption : localAnswers[currentIndex];

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border)] sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2.5">
          {/* Exit */}
          <button
            onClick={handleExit}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-strong)] font-medium flex-shrink-0"
          >
            <FiArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Exit</span>
          </button>

          {/* Mode + title */}
          <div className="flex items-center gap-2 min-w-0 flex-shrink overflow-hidden">
            <ModeBadge mode={mode} isReview={isReview} />
            <div className="hidden md:flex items-baseline gap-2 min-w-0">
              <p className="font-display text-sm font-extrabold text-[var(--text-strong)] truncate">{attempt.test?.title || 'Test'}</p>
              <p className="text-xs text-[var(--text-faint)] whitespace-nowrap">
                {attempt.questionBankTitle ? `${attempt.questionBankTitle} · ` : ''}{qas.length} MCQs
              </p>
            </div>
          </div>

          {/* Progress (center) */}
          <div className="flex-1 hidden sm:flex items-center gap-3 min-w-0 max-w-[440px] mx-auto">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)] whitespace-nowrap flex-shrink-0">
              Question {currentIndex + 1} / {qas.length}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden min-w-[60px]">
              <div className="h-full bg-primary-500 rounded-full transition-[width] duration-300" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)] whitespace-nowrap flex-shrink-0">
              {progressPct}% complete
            </span>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto sm:ml-0">
            {/* Timer pill — shown in BOTH live modes:
                  • tutor : elapsed only (no budget) — counts up forever
                  • timer : "elapsed / total" — auto-submits when elapsed = total
                For review we show a static "time taken" badge instead. */}
            {!isReview && mode === 'timer' && timeLeft !== null && (
              <TimerPill
                usedSec={(totalDurationSec || 0) - timeLeft}
                totalSec={totalDurationSec}
                mode="timer"
              />
            )}
            {!isReview && mode === 'tutor' && (
              <TimerPill usedSec={elapsedSec} mode="tutor" />
            )}
            {isReview && (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs text-[var(--text-muted)]">
                <FiClock className="w-3.5 h-3.5" />
                {formatShortTime(attempt.totalTimeSpent)}
              </div>
            )}

            {/* Theme toggle — students often switch mid-test (long sessions). */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-muted)]"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
            </button>

            {/* Palette toggle (mobile only — sidebar is permanent on lg+) */}
            <button
              onClick={() => setShowPalette(true)}
              className="lg:hidden p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
              title="Question palette"
            >
              <FiGrid className="w-4 h-4" />
            </button>

            {!isReview && (
              <>
                <button
                  onClick={handlePauseTest}
                  disabled={pausing || submitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
                >
                  {pausing
                    ? <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-[var(--text-muted)]" />
                    : <FiPause className="w-4 h-4" />}
                  <span className="hidden sm:inline">Pause</span>
                </button>
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={submitting}
                  className="btn-brand text-sm px-3 py-1.5"
                >
                  <span className="hidden sm:inline">Submit test</span>
                  <span className="sm:hidden">Submit</span>
                </button>
              </>
            )}
            {isReview && (
              <button
                onClick={() => navigate(`/student/tests/${testId}/result/${attemptId}`)}
                className="btn-brand text-sm px-3 py-1.5"
              >
                <FiBarChart2 className="w-4 h-4" />
                <span className="hidden sm:inline">Back to results</span>
                <span className="sm:hidden">Results</span>
              </button>
            )}
          </div>
        </div>
        {/* Mobile progress strip (under the top bar) */}
        <div className="sm:hidden px-3 pb-2 flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)] whitespace-nowrap">
            Q {currentIndex + 1} / {qas.length}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)] whitespace-nowrap">{progressPct}%</span>
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 grid lg:grid-cols-[1fr_320px] gap-4 px-3 sm:px-5 py-4 min-w-0 max-w-[1400px] mx-auto w-full">
        {/* Question column */}
        <main className="min-w-0">
          {/* Chips row + actions */}
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {subjectChip && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  <FiBookOpen className="w-3 h-3" />
                  {subjectChip}
                </span>
              )}
              {chapterChip && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--bg-muted)] text-[var(--text-muted)]">
                  {chapterChip}
                </span>
              )}
              {topicChip && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--bg-muted)] text-[var(--text-muted)]">
                  {topicChip}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleToggleMark}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  localMarks[currentIndex]
                    ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    : 'border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                <FiBookmark className={`w-3.5 h-3.5 ${localMarks[currentIndex] ? 'fill-amber-500' : ''}`} />
                <span>{localMarks[currentIndex] ? 'Marked' : 'Mark for review'}</span>
              </button>
              <button
                onClick={() => setShowReport(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
              >
                <FiFlag className="w-3.5 h-3.5" />
                <span>Report issue</span>
              </button>
            </div>
          </div>

          {/* Question card — compact padding so large MCQ content (long
              stems, image-heavy options) reads naturally without imposing
              chrome around it. */}
          <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-3 sm:p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)] mb-1.5">
              Question {currentIndex + 1}
            </p>
            {currentMcq ? (
              <div
                className="font-display text-[15px] sm:text-[16px] leading-snug font-bold text-[var(--text-strong)] prose prose-sm dark:prose-invert max-w-none [&_p]:!m-0"
                dangerouslySetInnerHTML={{ __html: fixImageUrls(currentMcq.questionText) }}
              />
            ) : (
              <p className="text-sm text-[var(--text-faint)] italic">Question not found.</p>
            )}

            {/* Options — popularity stats restored. When feedback is shown
                (tutor right after answering, or review always), each option
                shows what % of past attempters chose it. Stats live in
                `currentMcq.statistics.optionsSelections` as a Map<letter,count>.
                In tutor mode the user's pick isn't in DB yet, so we add a
                +1 bonus client-side so the bar reads accurately immediately. */}
            <div className="mt-3.5 space-y-2">
              {(() => {
                const stats     = currentMcq?.statistics?.optionsSelections || {};
                // optionsSelections also carries a 'total' counter alongside
                // the A/B/C/D/E per-letter counts (bumped server-side on every
                // completed attempt regardless of selection). Including it in
                // the denominator silently halves every option's percentage —
                // visible as bars that don't sum to 100. Restrict the sum to
                // letter keys so the percentages are "of those who picked an
                // answer", which is what the UI is trying to communicate.
                const baseTotal = Object.entries(stats)
                  .filter(([k]) => /^[A-E]$/.test(k))
                  .reduce((s, [, v]) => s + (Number(v) || 0), 0);
                // Tutor: optimistic +1 for the just-picked option so the bar
                // reflects this attempt without waiting for the DB write.
                // Review: nothing to add — stats already include this attempt.
                const optimistic = (hasFeedback && !isReview && userAnswer) ? 1 : 0;
                const displayTotal = baseTotal + optimistic;
                const pctFor = (letter) => {
                  if (!hasFeedback || displayTotal === 0) return null;
                  const base = Number(stats[letter]) || 0;
                  const bonus = (optimistic && userAnswer === letter) ? 1 : 0;
                  return Math.round(((base + bonus) / displayTotal) * 100);
                };

                return currentMcq?.options?.map((opt) => {
                  const isSelected   = userAnswer === opt.optionLetter;
                  const isCorrectOpt = opt.optionLetter === correctOptLetter;
                  const pct = pctFor(opt.optionLetter);

                  // Card / letter / icon style by state
                  let card = 'border-[var(--border)] hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/40 dark:hover:bg-primary-950/20 cursor-pointer';
                  let letter = 'bg-[var(--bg-muted)] text-[var(--text-muted)]';
                  let icon = null;
                  let pctBadge = 'bg-[var(--bg-muted)] text-[var(--text-muted)]';

                  if (hasFeedback) {
                    if (isCorrectOpt) {
                      card   = 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700 cursor-default';
                      letter = 'bg-emerald-500 text-white';
                      icon   = <FiCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />;
                      pctBadge = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300';
                    } else if (isSelected) {
                      card   = 'border-rose-400 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-700 cursor-default';
                      letter = 'bg-rose-500 text-white';
                      icon   = <FiX className="w-4 h-4 text-rose-600 dark:text-rose-300" />;
                      pctBadge = 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300';
                    } else {
                      card   = 'border-[var(--border)] opacity-70 cursor-default';
                    }
                  } else if (isSelected) {
                    card   = 'border-primary-400 bg-primary-50/60 dark:bg-primary-950/30 dark:border-primary-700 cursor-pointer';
                    letter = 'bg-primary-500 text-white';
                  }

                  return (
                    <button
                      key={opt._id}
                      type="button"
                      disabled={hasFeedback || isReview}
                      onClick={() => handleSelectOption(opt.optionLetter)}
                      className={`relative overflow-hidden w-full text-left p-2.5 sm:p-3 rounded-xl border-2 transition-all flex items-center gap-2.5 ${card}`}
                    >
                      {/* Subtle popularity fill — absolute, won't shift layout. */}
                      {pct !== null && (
                        <div
                          className="absolute left-0 top-0 h-full bg-black/[0.04] dark:bg-white/[0.04] pointer-events-none"
                          style={{ width: `${pct}%`, transition: 'width 0.6s ease-out' }}
                        />
                      )}
                      <span className={`relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${letter}`}>
                        {opt.optionLetter}
                      </span>
                      <span
                        className="relative z-10 flex-1 text-[13px] sm:text-sm text-[var(--text-strong)] prose prose-sm dark:prose-invert max-w-none [&_p]:!m-0"
                        dangerouslySetInnerHTML={{ __html: fixImageUrls(opt.optionText) }}
                      />
                      <div className="relative z-10 flex items-center gap-1.5 flex-shrink-0">
                        {pct !== null && (
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${pctBadge}`}>
                            {pct}%
                          </span>
                        )}
                        {icon}
                      </div>
                    </button>
                  );
                });
              })()}
            </div>

            {/* Tutor / Review feedback panel — explanation only; no chip row. */}
            {hasFeedback && (
              <div className="mt-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-1.5">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    <FiCheck className="w-3.5 h-3.5" />
                    Correct answer · {correctOptLetter}
                  </p>
                  {communityPct != null && (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      <strong className="text-[var(--text-strong)]">{communityPct}%</strong> got this right
                    </p>
                  )}
                </div>
                {currentMcq?.explanationText ? (
                  <div
                    className="text-[13px] text-[var(--text)] prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: fixImageUrls(currentMcq.explanationText) }}
                  />
                ) : (
                  <p className="text-[13px] text-[var(--text-muted)] italic">No explanation available for this question.</p>
                )}
              </div>
            )}
          </section>

          {/* Bottom nav */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              onClick={() => goToQuestion(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FiChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            {currentIndex < qas.length - 1 ? (
              <button
                onClick={() => goToQuestion(currentIndex + 1)}
                className="btn-brand text-sm px-3 sm:px-4 py-2"
              >
                <span className="hidden sm:inline">Next question</span>
                <span className="sm:hidden">Next</span>
                <FiChevronRight className="w-4 h-4" />
              </button>
            ) : !isReview ? (
              <button
                onClick={() => setShowSubmitConfirm(true)}
                disabled={submitting}
                className="btn-brand text-sm px-3 sm:px-4 py-2"
              >
                <FiCheck className="w-4 h-4" />
                Finish test
              </button>
            ) : (
              <button
                onClick={() => navigate(`/student/tests/${testId}/result/${attemptId}`)}
                className="btn-brand text-sm px-3 sm:px-4 py-2"
              >
                <FiBarChart2 className="w-4 h-4" />
                Results
              </button>
            )}
          </div>
        </main>

        {/* ── Right sidebar — desktop (lg+) ────────────────────────────── */}
        <div className="hidden lg:block">
          <div className="sticky top-[80px]">
            <QuestionPalette
              qas={qas}
              currentIndex={currentIndex}
              mode={mode}
              isReview={isReview}
              localAnswers={localAnswers}
              onNavigate={goToQuestion}
              onJumpUnanswered={jumpToNextUnanswered}
              attempt={attempt}
            />
          </div>
        </div>
      </div>

      {/* ── Mobile palette drawer ─────────────────────────────────────────── */}
      {showPalette && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 flex justify-end"
          onClick={() => setShowPalette(false)}
        >
          <div
            className="w-[320px] max-w-full h-full bg-[var(--bg)] p-3 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <QuestionPalette
              qas={qas}
              currentIndex={currentIndex}
              mode={mode}
              isReview={isReview}
              localAnswers={localAnswers}
              onNavigate={goToQuestion}
              onJumpUnanswered={jumpToNextUnanswered}
              onClose={() => setShowPalette(false)}
              attempt={attempt}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      {showReport && (
        <ReportModal
          onSubmit={handleReport}
          onClose={() => setShowReport(false)}
          submitting={reportSubmitting}
        />
      )}
      {showSubmitConfirm && (
        <SubmitConfirmModal
          unanswered={totalUnanswered}
          onConfirm={handleSubmitTest}
          onCancel={() => setShowSubmitConfirm(false)}
          submitting={submitting}
        />
      )}
      {showExitConfirm && (
        <ExitConfirmModal
          onConfirm={handleConfirmExit}
          onCancel={() => setShowExitConfirm(false)}
          exiting={exiting}
        />
      )}
    </div>
  );
};

export default TestPlayerPage;
