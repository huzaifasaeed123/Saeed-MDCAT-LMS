// modules/questionbank/pages/QBMCQListPage.jsx
// Lists all MCQs for a Question Bank (filtered by topicId / chapterId / subjectId)
// Mirrors TestDetailPage but operates in QB context.
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiEdit, FiTrash, FiEdit3, FiInfo, FiLock, FiArrowLeft, FiDatabase, FiFlag,
} from 'react-icons/fi';
import { fixImageUrls } from '../../../shared/utils/fixImageUrls';
import apiClient from '../../../core/api/axiosConfig';

const QBMCQListPage = () => {
  const { qbId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const topicId    = searchParams.get('topicId')    || '';
  const chapterId  = searchParams.get('chapterId')  || '';
  const subjectId  = searchParams.get('subjectId')  || '';
  const topicTitle = searchParams.get('topicTitle') || 'All MCQs';

  const [mcqs, setMcqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportCounts, setReportCounts] = useState({});

  useEffect(() => { fetchMcqs(); }, [qbId, topicId, chapterId, subjectId]);

  const fetchMcqs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (topicId)       params.append('topicId',   topicId);
      else if (chapterId) params.append('chapterId', chapterId);
      else if (subjectId) params.append('subjectId', subjectId);

      const res = await apiClient.get(`/mcqs/question-bank/${qbId}?${params}`);
      if (res.data.success) {
        setMcqs(res.data.data);
        // Batch-fetch open report counts for all MCQs in one request
        if (res.data.data.length > 0) {
          try {
            const ids = res.data.data.map(m => m._id).join(',');
            const countRes = await apiClient.get(`/mcq-reports/counts?mcqIds=${ids}`);
            setReportCounts(countRes.data.data || {});
          } catch (_) { /* non-critical */ }
        }
      }
    } catch {
      toast.error('Failed to load MCQs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (mcqId) => {
    if (!window.confirm('Delete this MCQ? It will be removed from this question bank.')) return;
    try {
      await apiClient.delete(`/mcqs/${mcqId}`);
      toast.success('MCQ deleted');
      setMcqs((prev) => prev.filter((m) => m._id !== mcqId));
    } catch {
      toast.error('Failed to delete MCQ');
    }
  };

  const getDifficultyBadge = (d) => {
    const map = {
      Easy:   'bg-green-100 text-green-800',
      Hard:   'bg-red-100 text-red-800',
      Medium: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${map[d] || map.Medium}`}>{d || 'Medium'}</span>
    );
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : 'N/A';

  // Build back link to QB detail
  const backUrl = `/admin/question-banks/${qbId}`;
  // Build sequential editor link — pass search params through
  const editAllParams = new URLSearchParams();
  if (topicId)       editAllParams.set('topicId',   topicId);
  else if (chapterId) editAllParams.set('chapterId', chapterId);
  else if (subjectId) editAllParams.set('subjectId', subjectId);
  const editAllUrl = `/admin/question-banks/${qbId}/mcqs/edit-all/0?${editAllParams}`;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <button onClick={() => navigate(backUrl)}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5 group">
        <FiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Question Bank
      </button>

      {/* Header */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FiDatabase className="text-indigo-500 w-5 h-5" />
              <h1 className="text-2xl font-bold text-gray-800">MCQ Bank: {topicTitle}</h1>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {mcqs.length} question{mcqs.length !== 1 ? 's' : ''} in this scope
            </p>
          </div>
          {mcqs.length > 0 && (
            <Link to={editAllUrl}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center text-sm">
              <FiEdit3 className="mr-2" /> Edit All MCQs
            </Link>
          )}
        </div>

        {/* Summary */}
        {mcqs.length > 0 && (
          <div className="flex gap-4 mt-4 text-sm flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-100 inline-block" />Easy: {mcqs.filter(m => m.difficulty === 'Easy').length}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-100 inline-block" />Medium: {mcqs.filter(m => !m.difficulty || m.difficulty === 'Medium').length}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-100 inline-block" />Hard: {mcqs.filter(m => m.difficulty === 'Hard').length}</span>
            <span className="flex items-center gap-1"><FiLock className="text-gray-400 w-3 h-3" />Private: {mcqs.filter(m => m.isPublic === false).length}</span>
          </div>
        )}
      </div>

      {/* MCQ List */}
      <div className="bg-white shadow-md rounded-lg p-6">
        {mcqs.length === 0 ? (
          <div className="text-center py-16">
            <FiInfo className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No MCQs in this scope yet.</p>
            <button onClick={() => navigate(`/admin/question-banks/${qbId}/import`)}
              className="mt-3 text-sm text-indigo-600 hover:underline font-medium">
              Import MCQs
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {mcqs.map((mcq, idx) => (
              <div key={mcq._id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                {/* Top bar */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center text-gray-700 font-semibold flex-shrink-0">
                      {idx + 1}
                    </div>
                    {getDifficultyBadge(mcq.difficulty)}
                    {mcq.isPublic === false && (
                      <span className="flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        <FiLock className="mr-1" /> Private
                      </span>
                    )}
                    {mcq.revisionCount > 0 && (
                      <span className="flex items-center text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded-full">
                        <FiEdit3 className="mr-1" /> Revised {mcq.revisionCount}×
                      </span>
                    )}
                    {reportCounts[mcq._id] > 0 && (
                      <span className="flex items-center text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-full font-semibold">
                        <FiFlag className="mr-1 w-3 h-3" /> {reportCounts[mcq._id]} report{reportCounts[mcq._id] > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/admin/question-banks/${qbId}/mcqs/${mcq._id}/edit?${editAllParams}`}
                      className="text-yellow-600 hover:text-yellow-900 p-2 rounded hover:bg-yellow-50" title="Edit">
                      <FiEdit className="w-5 h-5" />
                    </Link>
                    <button onClick={() => handleDelete(mcq._id)}
                      className="text-red-600 hover:text-red-900 p-2 rounded hover:bg-red-50" title="Delete">
                      <FiTrash className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Question */}
                <div className="prose max-w-none mb-3">
                  <div dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.questionText) }} />
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  {mcq.options?.map((opt) => (
                    <div key={opt._id || opt.optionLetter}
                      className={`p-2 rounded flex items-start ${opt.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                      <span className="font-medium mr-2 flex-shrink-0">{opt.optionLetter}.</span>
                      <span className="inline" dangerouslySetInnerHTML={{ __html: fixImageUrls(opt.optionText) }} />
                    </div>
                  ))}
                </div>

                {/* Explanation */}
                {mcq.explanationText && (
                  <div className="p-3 bg-blue-50 rounded mb-3">
                    <p className="text-sm font-semibold text-blue-800">Explanation:</p>
                    <div className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.explanationText) }} />
                  </div>
                )}

                {/* Metadata */}
                <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Author: {mcq.author || 'Unknown'}</span>
                  {mcq.lastRevised && <span>Last revised: {formatDate(mcq.lastRevised)}</span>}
                  <span>Created: {formatDate(mcq.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QBMCQListPage;
