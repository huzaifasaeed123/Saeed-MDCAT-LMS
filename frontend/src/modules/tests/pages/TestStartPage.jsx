import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiClock, FiList, FiTarget, FiCheckCircle, FiAlertCircle, FiPlayCircle, FiBookOpen, FiRotateCcw } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';

// Speed multipliers — 1x = 60s/Q, 1.5x = 40s/Q, 2x = 30s/Q
const TIME_MULTIPLIERS = [
  { label: 'Standard (1×)',  value: 1.0, description: '60 sec / question', secsPerQ: 60 },
  { label: 'Fast (1.5×)',    value: 1.5, description: '40 sec / question', secsPerQ: 40 },
  { label: 'Very Fast (2×)', value: 2.0, description: '30 sec / question', secsPerQ: 30 },
];

const TestStartPage = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [test, setTest] = useState(null);
  const [selectedMode, setSelectedMode] = useState('tutor');
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
        setTest(testRes.data.data);

        const active = activeRes.data.data;
        if (active) {
          setExistingAttempt(active);
          setSelectedMode(active.mode);
        }
        if (activeRes.data.attemptInfo?.completedAttempts != null) {
          setCompletedAttempts(activeRes.data.attemptInfo.completedAttempts);
        }
      })
      .catch(() => { toast.error('Test not found'); navigate('/student/tests'); })
      .finally(() => setLoading(false));
  }, [testId, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
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

  // Attempt-limit derived state. maxAttempts comes from the test summary
  // we already loaded — NO extra server read for it. attemptsRemaining===0
  // means the student is locked out; Start is disabled. Resume of an
  // in-progress attempt is still allowed (already counted server-side).
  const maxAttempts       = test?.maxAttempts ?? null;
  const isUnlimited       = maxAttempts == null;
  const attemptsRemaining = isUnlimited ? null : Math.max(0, maxAttempts - completedAttempts);
  const limitReached      = !isUnlimited && attemptsRemaining === 0 && !existingAttempt;

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await apiClient.post('/user-tests/start', {
        testId,
        mode: selectedMode,
        totalDurationSec: calculatedDurationSec || null,
      });
      const attempt = res.data.data;
      // Pass attempt data via state so TestPlayerPage skips an extra GET /user-tests/:id call
      navigate(
        `/student/tests/${testId}/play?attemptId=${attempt._id}`,
        { state: { attemptData: attempt } }
      );
    } catch (err) {
      // attemptLimitReached comes back from startTest when a student has used
      // all allowed attempts. Sync local state so the UI flips into the
      // locked-out view without another /active round-trip.
      if (err.response?.data?.attemptLimitReached) {
        // Sync the local counter so the UI flips into locked-out without
        // another round-trip. maxAttempts comes from the test object.
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
      navigate(
        `/student/tests/${testId}/play?attemptId=${attempt._id}`,
        { state: { attemptData: attempt } }
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resume test');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{test?.title}</h1>
        {test?.description && <p className="text-gray-500 text-sm mb-4">{test.description}</p>}

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="flex flex-col items-center bg-blue-50 rounded-xl p-4">
            <FiList className="text-blue-500 w-6 h-6 mb-1" />
            <span className="text-2xl font-bold text-blue-700">{totalQuestions}</span>
            <span className="text-xs text-blue-500 mt-1">Questions</span>
          </div>
          <div className="flex flex-col items-center bg-purple-50 rounded-xl p-4">
            <FiTarget className="text-purple-500 w-6 h-6 mb-1" />
            <span className="text-2xl font-bold text-purple-700">{test?.passingScore ?? 50}%</span>
            <span className="text-xs text-purple-500 mt-1">Passing</span>
          </div>
          <div className="flex flex-col items-center bg-green-50 rounded-xl p-4">
            <span className="text-2xl mb-1">🎯</span>
            <span className="text-lg font-bold text-green-700">{test?.difficultyLevel || 'Mixed'}</span>
            <span className="text-xs text-green-500 mt-1">Difficulty</span>
          </div>
        </div>

        {test?.instructions && (
          <div className="mt-5 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
            <p className="text-sm font-semibold text-yellow-800 mb-1">Instructions</p>
            <p className="text-sm text-yellow-700">{test.instructions}</p>
          </div>
        )}

        {/* Attempts row — derived from server-side count + test.maxAttempts.
            Shows "Unlimited" for the default, or "X of N used" when limited. */}
        <div className="mt-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
          <FiRotateCcw className="text-gray-500 w-4 h-4 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-gray-800">Attempts: </span>
            {isUnlimited ? (
              <span className="text-emerald-600 font-medium">Unlimited</span>
            ) : (
              <>
                <span className={attemptsRemaining === 0 ? 'text-red-600 font-medium' : 'text-gray-800'}>
                  {completedAttempts} of {maxAttempts} used
                </span>
                {attemptsRemaining > 0 && (
                  <span className="text-gray-500"> · {attemptsRemaining} remaining</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Syllabus — auto-derived from the MCQs added to this test
          (Test.subjects/chapters/topics are kept in sync server-side). */}
      {hasSyllabus && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <FiBookOpen className="text-primary-500 w-5 h-5" /> Test Syllabus
          </h2>
          <div className="space-y-3">
            {syllabus.subjects.length > 0 && (
              <SyllabusRow label="Subjects" items={syllabus.subjects} color="blue" />
            )}
            {syllabus.chapters.length > 0 && (
              <SyllabusRow label="Chapters" items={syllabus.chapters} color="purple" />
            )}
            {syllabus.topics.length > 0 && (
              <SyllabusRow label="Topics" items={syllabus.topics} color="emerald" />
            )}
          </div>
        </div>
      )}

      {/* Resume banner */}
      {existingAttempt && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FiAlertCircle className="text-blue-500 w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">You have an unfinished attempt</p>
              <p className="text-xs text-blue-600">
                {existingAttempt.answeredCount} / {existingAttempt.totalCount} answered
              </p>
            </div>
          </div>
          <button
            onClick={handleResume}
            disabled={starting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {starting ? '…' : 'Resume'}
          </button>
        </div>
      )}

      {/* Mode selection (hidden when resuming) */}
      {!existingAttempt && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Select Test Mode</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedMode('tutor')}
              className={`relative p-5 rounded-xl border-2 text-left transition-all ${
                selectedMode === 'tutor' ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-200'
              }`}
            >
              {selectedMode === 'tutor' && <FiCheckCircle className="absolute top-3 right-3 text-orange-500 w-5 h-5" />}
              <div className="text-2xl mb-2">🎓</div>
              <h3 className="font-semibold text-gray-900">Tutor Mode</h3>
              <p className="text-xs text-gray-500 mt-1">Instant feedback after each answer with explanation</p>
            </button>

            <button
              onClick={() => setSelectedMode('timer')}
              className={`relative p-5 rounded-xl border-2 text-left transition-all ${
                selectedMode === 'timer' ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-200'
              }`}
            >
              {selectedMode === 'timer' && <FiCheckCircle className="absolute top-3 right-3 text-orange-500 w-5 h-5" />}
              <div className="text-2xl mb-2">⏱️</div>
              <h3 className="font-semibold text-gray-900">Timed Mode</h3>
              <p className="text-xs text-gray-500 mt-1">Complete within time limit. Results shown at end.</p>
            </button>
          </div>

          {/* Time multiplier — shown only in timer mode */}
          {selectedMode === 'timer' && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FiClock className="w-4 h-4 text-orange-500" /> Time Allocation
              </p>
              <div className="grid grid-cols-3 gap-2">
                {TIME_MULTIPLIERS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTimeMultiplier(opt.value)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      timeMultiplier === opt.value
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-200'
                    }`}
                  >
                    <p className="text-sm font-bold text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                  </button>
                ))}
              </div>
              {totalQuestions > 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm text-orange-700 bg-orange-50 rounded-xl px-4 py-2.5">
                  <FiClock className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Total time: <strong>{calculatedDurationMin} min</strong>
                    {' '}({totalQuestions} questions × {selectedMultiplier?.secsPerQ ?? 60} sec each)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Attempt-limit lockout banner. Resume is still available even when
          locked out — the in-progress attempt was already counted. */}
      {limitReached && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <FiAlertCircle className="text-red-500 w-5 h-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">You've used all attempts</p>
            <p className="text-xs text-red-600">
              You've completed all {maxAttempts} allowed attempts for this test.
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {existingAttempt && (
          <button
            onClick={handleResume}
            disabled={starting}
            className="flex-1 py-3 px-6 rounded-xl border-2 border-blue-300 text-blue-600 font-semibold hover:bg-blue-50 disabled:opacity-50"
          >
            Resume Test
          </button>
        )}
        <button
          onClick={handleStart}
          disabled={starting || totalQuestions === 0 || limitReached}
          className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {starting
            ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            : <FiPlayCircle className="w-6 h-6" />}
          {starting ? 'Starting...' : existingAttempt ? 'Start Fresh' : 'Start Test'}
        </button>
      </div>

      {totalQuestions === 0 && (
        <p className="text-center text-sm text-red-500 mt-3">This test has no questions yet.</p>
      )}
    </div>
  );
};

const SYLLABUS_COLORS = {
  blue:    'bg-blue-50 text-blue-700 border-blue-200',
  purple:  'bg-purple-50 text-purple-700 border-purple-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const SyllabusRow = ({ label, items, color }) => (
  <div>
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</p>
    <div className="flex flex-wrap gap-1.5">
      {items.map((v) => (
        <span key={v} className={`px-2.5 py-1 text-xs font-medium rounded-full border ${SYLLABUS_COLORS[color]}`}>
          {v}
        </span>
      ))}
    </div>
  </div>
);

export default TestStartPage;
