import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiChevronLeft, FiChevronRight, FiCheck, FiX, FiBarChart2, FiBookmark, FiAlertCircle } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { fixImageUrls } from '../../../shared/utils/fixImageUrls';

const TestAttemptReviewPage = () => {
  const { testId, attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    apiClient.get(`/user-tests/${attemptId}`)
      .then((res) => setAttempt(res.data.data))
      .catch(() => {
        toast.error('Failed to load attempt');
        navigate(`/student/tests/${testId}/result/${attemptId}`);
      })
      .finally(() => setLoading(false));
  }, [attemptId, testId, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }
  if (!attempt) return null;

  const qas = attempt.questionAttempts || [];
  const qa = qas[currentIndex];
  const mcq = qa?.mcqId;
  const correctLetter = mcq?.options?.find((o) => o.isCorrect)?.optionLetter;
  const userLetter = qa?.selectedOption;
  const total = qas.length;
  const correct = qas.filter((q) => q.isCorrect).length;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate(`/student/tests/${testId}/result/${attemptId}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-500 font-medium"
        >
          <FiChevronLeft className="w-4 h-4" /> Back to Results
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
            {correct}/{total} correct
          </span>
          <span className="text-sm font-semibold text-gray-600">
            {currentIndex + 1} / {total}
          </span>
        </div>
      </div>

      {/* Question navigator dots */}
      <div className="flex gap-1.5 flex-wrap mb-6">
        {qas.map((q, i) => {
          const hasAnswer = !!q.selectedOption;
          let bg = 'bg-gray-200 text-gray-600';
          if (hasAnswer) bg = q.isCorrect ? 'bg-green-400 text-white' : 'bg-red-400 text-white';
          if (i === currentIndex) bg = 'bg-orange-500 text-white ring-2 ring-orange-300';
          return (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${bg}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-400 mb-5">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400 inline-block" /> Correct</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Wrong</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block" /> Skipped</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500 inline-block" /> Current</span>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        {/* Question meta row */}
        <div className="flex items-center flex-wrap gap-2 mb-4">
          {userLetter ? (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${qa.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {qa.isCorrect ? <FiCheck className="w-3 h-3" /> : <FiX className="w-3 h-3" />}
              {qa.isCorrect ? 'Correct' : 'Incorrect'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
              Skipped
            </span>
          )}

          {/* Difficulty */}
          {mcq?.difficulty && (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              mcq.difficulty === 'Easy' ? 'bg-green-50 text-green-600'
              : mcq.difficulty === 'Hard' ? 'bg-red-50 text-red-600'
              : 'bg-yellow-50 text-yellow-600'
            }`}>
              {mcq.difficulty}
            </span>
          )}

          {/* Marked / Saved badges */}
          {qa?.markedForReview && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
              <FiBookmark className="w-3 h-3" /> Bookmarked
            </span>
          )}
          {qa?.reported && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
              <FiAlertCircle className="w-3 h-3" /> Reported
            </span>
          )}
        </div>

        {/* Question text */}
        {mcq ? (
          <div
            className="prose prose-sm max-w-none text-gray-800 mb-6"
            dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.questionText) }}
          />
        ) : (
          <p className="text-gray-400 italic mb-6">Question data not available</p>
        )}

        {/* Options */}
        <div className="space-y-2.5">
          {mcq?.options?.map((opt) => {
            const isCorrectOpt = opt.isCorrect;
            const isUserPick = userLetter === opt.optionLetter;
            let cls = 'border-gray-200 bg-gray-50';
            let labelCls = 'bg-gray-200 text-gray-600';
            let icon = null;

            if (isCorrectOpt) {
              cls = 'border-green-400 bg-green-50';
              labelCls = 'bg-green-500 text-white';
              icon = <FiCheck className="w-4 h-4 text-green-500 flex-shrink-0" />;
            } else if (isUserPick) {
              cls = 'border-red-400 bg-red-50';
              labelCls = 'bg-red-400 text-white';
              icon = <FiX className="w-4 h-4 text-red-400 flex-shrink-0" />;
            }

            return (
              <div key={opt._id} className={`flex items-start gap-3 p-3.5 rounded-xl border-2 ${cls}`}>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${labelCls}`}>
                  {opt.optionLetter}
                </span>
                <div className="flex-1">
                  <span className="text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: fixImageUrls(opt.optionText) }} />
                  {/* Per-option explanation */}
                  {isCorrectOpt && opt.explanationText && (
                    <p className="text-xs text-green-700 mt-1.5 italic">{opt.explanationText}</p>
                  )}
                </div>
                {icon && <div className="mt-0.5">{icon}</div>}
              </div>
            );
          })}
        </div>

        {/* Answer summary for wrong answers */}
        {userLetter && !qa?.isCorrect && (
          <div className="mt-4 flex flex-wrap gap-4 text-xs p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="flex items-center gap-1.5 text-red-600">
              <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
              Your answer: <strong>{userLetter}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-green-700">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
              Correct answer: <strong>{correctLetter}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Overall Explanation */}
      {mcq?.explanationText && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-blue-800 mb-1.5">📖 Explanation</p>
          <div
            className="text-sm text-blue-700 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.explanationText) }}
          />
        </div>
      )}

      {/* Report reason if reported */}
      {qa?.reported && qa?.reportReason && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-orange-800 mb-1">Your Report</p>
          <p className="text-sm text-orange-700">{qa.reportReason}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-medium hover:border-orange-300 hover:text-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FiChevronLeft className="w-5 h-5" /> Previous
        </button>

        <button
          onClick={() => navigate(`/student/tests/${testId}/result/${attemptId}`)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50"
        >
          <FiBarChart2 className="w-4 h-4" /> Analytics
        </button>

        <button
          onClick={() => setCurrentIndex((i) => Math.min(qas.length - 1, i + 1))}
          disabled={currentIndex === qas.length - 1}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next <FiChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default TestAttemptReviewPage;
