import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiChevronLeft, FiChevronRight, FiBookmark, FiHeart, FiMaximize2, FiMinimize2,
  FiGrid, FiFlag, FiX, FiCheck, FiSend, FiPause
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { fixImageUrls } from '../../../shared/utils/fixImageUrls';

const REPORT_REASONS = [
  'Question Statement Wrong',
  'Option Wrong',
  'Answer Key is Incorrect',
  'Wrong Explanation',
  'Need Explanation',
];

// ── Question Navigator Panel ─────────────────────────────────────────────────
const NavigatorPanel = ({ questionAttempts, currentIndex, mode, localAnswers, onNavigate, onClose }) => {
  const activeRef = useRef(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  const getColor = (i, qa) => {
    if (i === currentIndex) return 'bg-orange-500 text-white';
    if (qa.markedForReview) return 'bg-blue-500 text-white';
    const answered = localAnswers[i] != null;
    if (answered && mode === 'tutor') {
      return qa.isCorrect ? 'bg-green-500 text-white' : 'bg-red-400 text-white';
    }
    if (answered) return 'bg-green-500 text-white';
    return 'bg-white border border-gray-300 text-gray-600';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 w-64 flex flex-col max-h-[80vh]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Question Map</span>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 overflow-y-auto flex-1">
        {questionAttempts.map((qa, i) => (
          <button
            key={i}
            ref={i === currentIndex ? activeRef : null}
            onClick={() => onNavigate(i)}
            className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${getColor(i, qa)}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-1 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-gray-300 inline-block" /> Not answered</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Answered</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Bookmarked</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500 inline-block" /> Active</span>
      </div>
    </div>
  );
};

// ── Report Modal ─────────────────────────────────────────────────────────────
const ReportModal = ({ onSubmit, onClose, submitting }) => {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Report Question</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-orange-500"
                />
                <span className="text-sm text-gray-700">{r}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Details (optional)</label>
          <textarea
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Describe the issue..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(reason, details)}
            disabled={!reason || submitting}
            className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-white" /> : <FiSend className="w-4 h-4" />}
            Submit Report
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Submit Confirm Modal ─────────────────────────────────────────────────────
const SubmitConfirmModal = ({ unanswered, onConfirm, onCancel, submitting }) => (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
      <div className="text-4xl mb-3">📋</div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Submit Test?</h3>
      {unanswered > 0 ? (
        <p className="text-sm text-amber-600 mb-5">
          You have <strong>{unanswered}</strong> unanswered question{unanswered > 1 ? 's' : ''}. Are you sure you want to submit?
        </p>
      ) : (
        <p className="text-sm text-gray-600 mb-5">All questions answered. Ready to submit?</p>
      )}
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={submitting}
          className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting && <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-white" />}
          Yes, Submit
        </button>
      </div>
    </div>
  </div>
);

// ── Timer Display ─────────────────────────────────────────────────────────────
const TimerDisplay = ({ secondsLeft }) => {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const isLow = secondsLeft <= 60;
  return (
    <span className={`font-mono font-bold text-lg tabular-nums ${isLow ? 'text-red-500 animate-pulse' : 'text-gray-700'}`}>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const TestPlayerPage = () => {
  const { testId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const attemptId = searchParams.get('attemptId');
  const durationOverride = searchParams.get('duration');

  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Local state for fast UI — no per-answer API calls during the test
  const [localAnswers, setLocalAnswers]         = useState({});  // { idx: 'A'|'B'... }
  const [localMarks, setLocalMarks]             = useState({});  // { idx: bool }
  const [localSaved, setLocalSaved]             = useState({});  // { idx: bool }
  const [tutorFeedback, setTutorFeedback]       = useState({});  // { idx: { isCorrect } }
  // Correct option per question index — populated from attempt.questionAttempts on load
  const [localCorrectOptions, setLocalCorrectOptions] = useState({}); // { idx: 'A'|... }

  const [timeLeft, setTimeLeft]               = useState(null);
  const [totalDurationSec, setTotalDurationSec] = useState(null); // full timer duration for pause/submit calc

  // UI state
  const [showNavigator, setShowNavigator]     = useState(true);
  const [isFullscreen, setIsFullscreen]       = useState(false);
  const [showReport, setShowReport]           = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [pausing, setPausing]                 = useState(false);

  // ── Load attempt ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!attemptId) {
      navigate(`/student/tests/${testId}`);
      return;
    }
    const fetchAttempt = async () => {
      try {
        // Prefer attempt data passed via navigation state (avoids an extra round-trip).
        // Fall back to fetching when navigating directly (e.g., browser refresh, history page).
        const stateAttempt = location.state?.attemptData;
        const res = stateAttempt
          ? { data: { data: stateAttempt } }
          : await apiClient.get(`/user-tests/${attemptId}`);
        const a = res.data.data;
        if (a.status === 'completed') {
          navigate(`/student/tests/${testId}/result/${attemptId}`);
          return;
        }
        setAttempt(a);
        setCurrentIndex(a.currentQuestionIndex || 0);

        // Initialise local state from DB
        const answers = {}, marks = {}, saved = {}, feedback = {}, correctOpts = {};
        a.questionAttempts.forEach((qa, i) => {
          if (qa.correctOption) correctOpts[i] = qa.correctOption;
          if (qa.selectedOption) answers[i] = qa.selectedOption;
          if (qa.markedForReview) marks[i] = true;
          if (qa.saved) saved[i] = true;
          if (qa.selectedOption && a.mode === 'tutor') feedback[i] = { isCorrect: qa.isCorrect };
        });
        setLocalAnswers(answers);
        setLocalMarks(marks);
        setLocalSaved(saved);
        setTutorFeedback(feedback);
        setLocalCorrectOptions(correctOpts);

        if (a.mode === 'timer') {
          const totalQ   = a.questionAttempts?.length || 0;
          // Prefer stored duration (set at start) → URL param (old flow) → default 60s/Q
          const totalSec = a.totalDurationSec
            || (durationOverride ? parseInt(durationOverride, 10) : null)
            || totalQ * 60;
          // If test was paused, totalTimeSpent holds seconds already used (more accurate than wall-clock)
          const timeUsed = a.totalTimeSpent > 0
            ? a.totalTimeSpent
            : Math.floor((Date.now() - new Date(a.startTime).getTime()) / 1000);
          setTotalDurationSec(totalSec);
          setTimeLeft(Math.max(0, totalSec - timeUsed));
        }
      } catch {
        toast.error('Failed to load test');
        navigate(`/student/tests/${testId}`);
      } finally {
        setLoading(false);
      }
    };
    fetchAttempt();
  }, [attemptId, testId, navigate, location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer countdown (timer mode) ─────────────────────────────────────────
  useEffect(() => {
    if (timeLeft === null || attempt?.mode !== 'timer') return;
    if (timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { handleSubmitTest(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timeLeft, attempt?.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigate — no per-navigation save API call ────────────────────────────
  const goToQuestion = useCallback((newIdx) => {
    if (!attempt || newIdx < 0 || newIdx >= attempt.questionAttempts.length) return;
    setCurrentIndex(newIdx);
  }, [attempt]);

  // ── Answer selection — computed locally, zero API calls during test ───────
  const handleSelectOption = (optionLetter) => {
    if (!attempt) return;
    const mode = attempt.mode;

    // In tutor mode, lock answer once feedback shown
    if (mode === 'tutor' && tutorFeedback[currentIndex] !== undefined) return;

    setLocalAnswers((prev) => ({ ...prev, [currentIndex]: optionLetter }));

    if (mode === 'tutor') {
      const correctOpt = localCorrectOptions[currentIndex];
      if (correctOpt) {
        // Compute feedback locally — no API call
        const isCorrect = optionLetter === correctOpt;
        setTutorFeedback((prev) => ({ ...prev, [currentIndex]: { isCorrect } }));
        // Mirror isCorrect back into attempt so NavigatorPanel colours correctly
        setAttempt((prev) => {
          if (!prev) return prev;
          const qa = [...prev.questionAttempts];
          qa[currentIndex] = { ...qa[currentIndex], selectedOption: optionLetter, isCorrect };
          return { ...prev, questionAttempts: qa };
        });
      } else {
        // Legacy attempt without correctOption — fall back to API
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

  // ── Mark for review — purely local during test ────────────────────────────
  const handleToggleMark = () => {
    const newVal = !localMarks[currentIndex];
    setLocalMarks((prev) => ({ ...prev, [currentIndex]: newVal }));
    setAttempt((prev) => {
      if (!prev) return prev;
      const qa = [...prev.questionAttempts];
      qa[currentIndex] = { ...qa[currentIndex], markedForReview: newVal };
      return { ...prev, questionAttempts: qa };
    });
  };

  // ── Favourite (save) — creates SavedQuestion immediately ─────────────────
  const handleToggleSave = async () => {
    const isSaved = localSaved[currentIndex];
    setLocalSaved((prev) => ({ ...prev, [currentIndex]: !isSaved }));
    try {
      if (isSaved) {
        const mcqId = attempt.questionAttempts[currentIndex]?.mcqId?._id;
        await apiClient.delete(`/user-tests/saved-questions/mcq/${mcqId}`);
      } else {
        await apiClient.put(`/user-tests/${attemptId}/save/${currentIndex}`);
      }
    } catch {
      setLocalSaved((prev) => ({ ...prev, [currentIndex]: isSaved }));
      toast.error('Failed to update favourite');
    }
  };

  // ── Report — creates MCQReport immediately ────────────────────────────────
  const handleReport = async (reason, details) => {
    setReportSubmitting(true);
    try {
      const mcqId = attempt.questionAttempts[currentIndex]?.mcqId?._id;
      await apiClient.post('/mcq-reports', {
        mcqId,
        testId: attempt.test?._id,
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

  // ── Submit test — batch submit all answers in one request ─────────────────
  const handleSubmitTest = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setShowSubmitConfirm(false);

    // Build answers array from local state
    const answers = attempt?.questionAttempts.map((_, i) => ({
      questionIndex:   i,
      selectedOption:  localAnswers[i] ?? null,
      markedForReview: localMarks[i]   ?? false,
    })) ?? [];

    const totalTimeSpent = attempt?.mode === 'timer' && totalDurationSec
      ? totalDurationSec - (timeLeft ?? 0)
      : undefined;

    try {
      await apiClient.put(`/user-tests/${attemptId}/complete`, { answers, totalTimeSpent });
      navigate(`/student/tests/${testId}/result/${attemptId}`);
    } catch {
      toast.error('Failed to submit test');
      setSubmitting(false);
    }
  }, [submitting, attempt, localAnswers, localMarks, attemptId, testId, navigate, totalDurationSec, timeLeft]);

  // ── Pause test — batch save all local state, stay in-progress ─────────────
  const handlePauseTest = useCallback(async () => {
    if (pausing || submitting) return;
    setPausing(true);

    const answers = attempt?.questionAttempts.map((_, i) => ({
      questionIndex:   i,
      selectedOption:  localAnswers[i] ?? null,
      markedForReview: localMarks[i]   ?? false,
    })) ?? [];

    const timeSpent = totalDurationSec !== null ? totalDurationSec - (timeLeft ?? 0) : undefined;

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

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (showReport || showSubmitConfirm) return;
      if (e.key === 'ArrowRight') goToQuestion(currentIndex + 1);
      if (e.key === 'ArrowLeft') goToQuestion(currentIndex - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIndex, goToQuestion, showReport, showSubmitConfirm]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!attempt) return null;

  const qas              = attempt.questionAttempts;
  const currentQA        = qas[currentIndex];
  const currentMcq       = currentQA?.mcqId;
  const mode             = attempt.mode;
  const hasFeedback      = tutorFeedback[currentIndex] !== undefined;
  const correctOptLetter = localCorrectOptions[currentIndex] ?? currentMcq?.options?.find((o) => o.isCorrect)?.optionLetter;
  const totalUnanswered  = qas.filter((_, i) => !localAnswers[i]).length;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNavigator((v) => !v)}
            className={`p-2 rounded-lg transition-colors ${showNavigator ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}
            title="Toggle question map"
          >
            <FiGrid className="w-5 h-5" />
          </button>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-none">{attempt.test?.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {mode === 'tutor' ? '🎓 Tutor Mode' : '⏱️ Timed Mode'} · Q {currentIndex + 1}/{qas.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mode === 'timer' && timeLeft !== null && <TimerDisplay secondsLeft={timeLeft} />}
          <button onClick={toggleFullscreen} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            {isFullscreen ? <FiMinimize2 className="w-5 h-5" /> : <FiMaximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={handlePauseTest}
            disabled={pausing || submitting}
            title="Save progress and exit"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {pausing
              ? <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-gray-500" />
              : <FiPause className="w-4 h-4" />}
            Pause
          </button>
          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={submitting || pausing}
            className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-50"
          >
            Submit Test
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigator */}
        {showNavigator && (
          <div className="hidden md:block p-4 flex-shrink-0">
            <NavigatorPanel
              questionAttempts={qas}
              currentIndex={currentIndex}
              mode={mode}
              localAnswers={localAnswers}
              onNavigate={goToQuestion}
            />
          </div>
        )}

        {/* Mobile navigator overlay */}
        {showNavigator && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/40 flex justify-start" onClick={() => setShowNavigator(false)}>
            <div className="p-4 bg-gray-50" onClick={(e) => e.stopPropagation()}>
              <NavigatorPanel
                questionAttempts={qas}
                currentIndex={currentIndex}
                mode={mode}
                localAnswers={localAnswers}
                onNavigate={(i) => { goToQuestion(i); setShowNavigator(false); }}
                onClose={() => setShowNavigator(false)}
              />
            </div>
          </div>
        )}

        {/* Question area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-3xl mx-auto">
            {/* Question header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-500">
                Question {currentIndex + 1} of {qas.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleMark}
                  title={localMarks[currentIndex] ? 'Remove bookmark' : 'Bookmark for review'}
                  className={`p-2 rounded-lg transition-colors ${localMarks[currentIndex] ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}
                >
                  <FiBookmark className={`w-4 h-4 ${localMarks[currentIndex] ? 'fill-blue-600' : ''}`} />
                </button>
                <button
                  onClick={handleToggleSave}
                  title="Save to favourites"
                  className={`p-2 rounded-lg transition-colors ${localSaved[currentIndex] ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-400 hover:bg-red-50'}`}
                >
                  <FiHeart className={`w-4 h-4 ${localSaved[currentIndex] ? 'fill-red-500' : ''}`} />
                </button>
                <button
                  onClick={() => setShowReport(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-colors"
                >
                  <FiFlag className="w-3.5 h-3.5" />
                  Report
                </button>
              </div>
            </div>

            {/* Question text */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
              {currentMcq ? (
                <div
                  className="prose prose-sm max-w-none text-gray-800"
                  dangerouslySetInnerHTML={{ __html: fixImageUrls(currentMcq.questionText) }}
                />
              ) : (
                <p className="text-gray-400 italic">Question not found</p>
              )}
            </div>

            {/* Options */}
            <div className="space-y-3 mb-6">
              {(() => {
                const optStats  = currentMcq?.statistics?.optionsSelections || {};
                const baseTotal = optStats.total || 0;
                // In tutor mode the user's pick isn't in DB yet (fire-and-forget on submit).
                // Add it client-side so stats render immediately on click, even on first-ever attempt.
                const userPick  = hasFeedback ? (localAnswers[currentIndex] || null) : null;
                const dispTotal = hasFeedback ? baseTotal + 1 : 0;

                const getPct = (letter) => {
                  if (!hasFeedback || dispTotal === 0) return null;
                  const base  = optStats[letter] || 0;
                  const bonus = userPick === letter ? 1 : 0;
                  return Math.round(((base + bonus) / dispTotal) * 100);
                };

                return currentMcq?.options?.map((opt) => {
                  const isSelected   = localAnswers[currentIndex] === opt.optionLetter;
                  const isCorrectOpt = opt.optionLetter === correctOptLetter;
                  const pct          = getPct(opt.optionLetter);

                  let cls = 'bg-white border-gray-200 hover:border-orange-300 hover:bg-orange-50 cursor-pointer';
                  if (hasFeedback) {
                    if (isCorrectOpt)      cls = 'bg-green-50 border-green-400 cursor-default';
                    else if (isSelected)   cls = 'bg-red-50 border-red-400 cursor-default';
                    else                   cls = 'bg-white border-gray-200 cursor-default opacity-70';
                  } else if (isSelected) {
                    cls = 'bg-orange-50 border-orange-400 cursor-pointer';
                  }

                  const pctBadgeCls = isCorrectOpt
                    ? 'bg-green-100 text-green-700'
                    : isSelected
                    ? 'bg-red-100 text-red-600'
                    : 'bg-gray-100 text-gray-500';

                  return (
                    <button
                      key={opt._id}
                      onClick={() => !hasFeedback && handleSelectOption(opt.optionLetter)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 relative overflow-hidden ${cls}`}
                    >
                      {/* Subtle popularity fill — absolute so it doesn't shift layout */}
                      {pct !== null && (
                        <div
                          className="absolute left-0 top-0 h-full bg-black/[0.05] pointer-events-none"
                          style={{ width: `${pct}%`, transition: 'width 0.6s ease-out' }}
                        />
                      )}

                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 relative z-10 ${
                        hasFeedback
                          ? isCorrectOpt ? 'bg-green-500 text-white'
                            : isSelected  ? 'bg-red-400 text-white'
                                          : 'bg-gray-200 text-gray-600'
                          : isSelected    ? 'bg-orange-500 text-white'
                                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {opt.optionLetter}
                      </span>

                      <span
                        className="flex-1 text-sm text-gray-800 relative z-10"
                        dangerouslySetInnerHTML={{ __html: fixImageUrls(opt.optionText) }}
                      />

                      {/* Right side: percentage badge + correct tick */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 relative z-10">
                        {pct !== null && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${pctBadgeCls}`}>
                            {pct}%
                          </span>
                        )}
                        {hasFeedback && isCorrectOpt && <FiCheck className="w-5 h-5 text-green-500" />}
                      </div>
                    </button>
                  );
                });
              })()}
            </div>

            {/* Tutor mode: overall explanation */}
            {hasFeedback && currentMcq?.explanationText && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="text-sm font-semibold text-blue-800 mb-1">Explanation</p>
                <div
                  className="text-sm text-blue-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: fixImageUrls(currentMcq.explanationText) }}
                />
              </div>
            )}

            {/* Tutor mode result banner */}
            {hasFeedback && (
              <div className={`rounded-xl px-4 py-3 mb-4 flex items-center gap-2 ${tutorFeedback[currentIndex]?.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {tutorFeedback[currentIndex]?.isCorrect
                  ? <><FiCheck className="w-5 h-5" /><span className="font-semibold">Correct! Well done.</span></>
                  : <><FiX className="w-5 h-5" /><span className="font-semibold">Incorrect. Correct answer: <strong>{correctOptLetter}</strong></span></>
                }
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => goToQuestion(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-medium hover:border-orange-300 hover:text-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <FiChevronLeft className="w-5 h-5" /> Previous
              </button>

              {currentIndex < qas.length - 1 ? (
                <button
                  onClick={() => goToQuestion(currentIndex + 1)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-all"
                >
                  Next <FiChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 disabled:opacity-50 transition-all"
                >
                  Finish Test <FiCheck className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-6">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{Object.keys(localAnswers).length} answered</span>
                <span>{totalUnanswered} remaining</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-400 rounded-full transition-all duration-300"
                  style={{ width: `${(Object.keys(localAnswers).length / qas.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
};

export default TestPlayerPage;
