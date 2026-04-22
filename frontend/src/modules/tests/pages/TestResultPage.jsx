import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiAward, FiClock, FiTarget, FiList, FiEye, FiBarChart2, FiHome } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';

// ── Circular Progress ─────────────────────────────────────────────────────────
const CircularProgress = ({ percentage, size = 140, strokeWidth = 12, color = '#f97316' }) => {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (percentage / 100) * circumference;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, color }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  </div>
);

// ── Bar Row ───────────────────────────────────────────────────────────────────
const BarRow = ({ label, count, total, color }) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-bold text-gray-700 w-8 text-right">{count}</span>
    </div>
  );
};

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
};

const TestResultPage = () => {
  const { testId, attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiClient.get(`/user-tests/${attemptId}`);
        setAttempt(res.data.data);
      } catch {
        toast.error('Failed to load results');
        navigate('/student/tests');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [attemptId, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!attempt) return null;

  const qas = attempt.questionAttempts || [];
  const total = qas.length;
  const correct = qas.filter((q) => q.isCorrect).length;
  const wrong = qas.filter((q) => q.selectedOption && !q.isCorrect).length;
  const skipped = qas.filter((q) => !q.selectedOption).length;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const totalTime = attempt.totalTimeSpent || 0;

  // Difficulty breakdown
  const diffBreakdown = { Easy: { c: 0, t: 0 }, Medium: { c: 0, t: 0 }, Hard: { c: 0, t: 0 } };
  qas.forEach((qa) => {
    const d = qa.mcqId?.difficulty || 'Medium';
    if (diffBreakdown[d]) {
      diffBreakdown[d].t += 1;
      if (qa.isCorrect) diffBreakdown[d].c += 1;
    }
  });

  const passingScore = attempt.test?.passingScore || 50;
  const passed = scorePercent >= passingScore;
  const scoreColor = passed ? '#22c55e' : scorePercent >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* ── Score Hero ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-1">{attempt.test?.title}</h1>
        <p className="text-sm text-gray-400 mb-6">
          {attempt.mode === 'tutor' ? '🎓 Tutor Mode' : '⏱️ Timed Mode'} ·{' '}
          {new Date(attempt.endTime || attempt.updatedAt).toLocaleDateString()}
        </p>

        <div className="flex items-center justify-center mb-4">
          <div className="relative">
            <CircularProgress percentage={scorePercent} color={scoreColor} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold" style={{ color: scoreColor }}>
                {scorePercent}%
              </span>
              <span className="text-xs text-gray-400">Score</span>
            </div>
          </div>
        </div>

        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          <FiAward className="w-4 h-4" />
          {passed ? 'Passed!' : 'Not Passed'} · {correct}/{total} correct
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard
          icon={<FiTarget className="w-6 h-6 text-green-600" />}
          label="Correct"
          value={correct}
          sub={`${scorePercent}% accuracy`}
          color="bg-green-50"
        />
        <StatCard
          icon={<FiList className="w-6 h-6 text-red-500" />}
          label="Wrong"
          value={wrong}
          sub={`${skipped} skipped`}
          color="bg-red-50"
        />
        <StatCard
          icon={<FiClock className="w-6 h-6 text-blue-500" />}
          label="Total Time"
          value={formatTime(totalTime)}
          sub="Total time spent"
          color="bg-blue-50"
        />
        <StatCard
          icon={<FiBarChart2 className="w-6 h-6 text-purple-500" />}
          label="Score"
          value={`${correct}/${total}`}
          sub={`Passing: ${passingScore}%`}
          color="bg-purple-50"
        />
      </div>

      {/* ── Answer breakdown chart ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Answer Breakdown</h2>
        <div className="space-y-3">
          <BarRow label="Correct" count={correct} total={total} color="bg-green-400" />
          <BarRow label="Wrong" count={wrong} total={total} color="bg-red-400" />
          <BarRow label="Skipped" count={skipped} total={total} color="bg-gray-300" />
        </div>
      </div>

      {/* ── Difficulty breakdown ─────────────────────────────────────────── */}
      {Object.values(diffBreakdown).some((d) => d.t > 0) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Performance by Difficulty</h2>
          <div className="space-y-4">
            {Object.entries(diffBreakdown)
              .filter(([, d]) => d.t > 0)
              .map(([level, d]) => {
                const pct = Math.round((d.c / d.t) * 100);
                const color = level === 'Easy' ? 'bg-green-400' : level === 'Medium' ? 'bg-yellow-400' : 'bg-red-400';
                return (
                  <div key={level}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{level}</span>
                      <span className="text-gray-500">{d.c}/{d.t} correct ({pct}%)</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Action buttons ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => navigate(`/student/tests/${testId}/review/${attemptId}`)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-all"
        >
          <FiEye className="w-5 h-5" /> Review Answers
        </button>
        <button
          onClick={() => navigate('/student/tests')}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-all"
        >
          <FiList className="w-5 h-5" /> Test History
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-all"
        >
          <FiHome className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default TestResultPage;
