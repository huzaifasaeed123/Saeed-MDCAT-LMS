// modules/questionbank/pages/QBMCQListPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiEdit, FiTrash, FiEdit3, FiInfo, FiLock, FiArrowLeft, FiDatabase, FiFlag,
  FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';
import { fixImageUrls } from '../../../shared/utils/fixImageUrls';
import apiClient from '../../../core/api/axiosConfig';

const PAGE_SIZE = 20;

const QBMCQListPage = () => {
  const { qbId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const topicId    = searchParams.get('topicId')    || '';
  const chapterId  = searchParams.get('chapterId')  || '';
  const subjectId  = searchParams.get('subjectId')  || '';
  const topicTitle = searchParams.get('topicTitle') || 'All MCQs';

  const [mcqs, setMcqs]               = useState([]);
  const [total, setTotal]             = useState(0);
  const [pages, setPages]             = useState(1);
  const [stats, setStats]             = useState({ easy: 0, medium: 0, hard: 0, private: 0 });
  const [loading, setLoading]         = useState(true);
  const [reportCounts, setReportCounts] = useState({});
  const [page, setPage]               = useState(1);

  // Reset to page 1 when scope changes
  useEffect(() => { setPage(1); }, [qbId, topicId, chapterId, subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMcqs(page);
  }, [page, qbId, topicId, chapterId, subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMcqs = async (pg) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit: PAGE_SIZE });
      if (topicId)        params.append('topicId',   topicId);
      else if (chapterId) params.append('chapterId', chapterId);
      else if (subjectId) params.append('subjectId', subjectId);

      const res = await apiClient.get(`/mcqs/question-bank/${qbId}?${params}`);
      if (res.data.success) {
        setMcqs(res.data.data);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 1);
        if (res.data.stats) setStats(res.data.stats);

        // Only fetch report counts for the current page's MCQ IDs
        if (res.data.data.length > 0) {
          try {
            const ids = res.data.data.map((m) => m._id).join(',');
            const countRes = await apiClient.get(`/mcq-reports/counts?mcqIds=${ids}`);
            setReportCounts(countRes.data.data || {});
          } catch (_) { /* non-critical */ }
        } else {
          setReportCounts({});
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
      // Refresh current page; go back one page if it becomes empty
      const newTotal = total - 1;
      const newPages = Math.ceil(newTotal / PAGE_SIZE) || 1;
      const pg = page > newPages ? newPages : page;
      setPage(pg);
      if (pg === page) fetchMcqs(pg);
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

  const backUrl    = `/admin/question-banks/${qbId}`;
  const editAllParams = new URLSearchParams();
  if (topicId)        editAllParams.set('topicId',   topicId);
  else if (chapterId) editAllParams.set('chapterId', chapterId);
  else if (subjectId) editAllParams.set('subjectId', subjectId);
  const editAllUrl = `/admin/question-banks/${qbId}/mcqs/edit-all/0?${editAllParams}`;

  if (loading && mcqs.length === 0) {
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
              {total} question{total !== 1 ? 's' : ''} in this scope
            </p>
          </div>
          {total > 0 && (
            <Link to={editAllUrl}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center text-sm">
              <FiEdit3 className="mr-2" /> Edit All MCQs
            </Link>
          )}
        </div>

        {total > 0 && (
          <div className="flex gap-4 mt-4 text-sm flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-100 inline-block" />Easy: {stats.easy}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-100 inline-block" />Medium: {stats.medium}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-100 inline-block" />Hard: {stats.hard}</span>
            <span className="flex items-center gap-1"><FiLock className="text-gray-400 w-3 h-3" />Private: {stats.private}</span>
          </div>
        )}
      </div>

      {/* MCQ List */}
      <div className="bg-white shadow-md rounded-lg p-6">
        {loading && mcqs.length > 0 && (
          <div className="flex justify-center py-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
          </div>
        )}

        {!loading && total === 0 ? (
          <div className="text-center py-16">
            <FiInfo className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No MCQs in this scope yet.</p>
            <button onClick={() => navigate(`/admin/question-banks/${qbId}/import`)}
              className="mt-3 text-sm text-indigo-600 hover:underline font-medium">
              Import MCQs
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {mcqs.map((mcq, idx) => {
                const globalIdx = (page - 1) * PAGE_SIZE + idx;
                return (
                  <div key={mcq._id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center text-gray-700 font-semibold flex-shrink-0">
                          {globalIdx + 1}
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

                    <div className="prose max-w-none mb-3">
                      <div dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.questionText) }} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                      {mcq.options?.map((opt) => (
                        <div key={opt._id || opt.optionLetter}
                          className={`p-2 rounded flex items-start ${opt.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                          <span className="font-medium mr-2 flex-shrink-0">{opt.optionLetter}.</span>
                          <span className="inline" dangerouslySetInnerHTML={{ __html: fixImageUrls(opt.optionText) }} />
                        </div>
                      ))}
                    </div>

                    {mcq.explanationText && (
                      <div className="p-3 bg-blue-50 rounded mb-3">
                        <p className="text-sm font-semibold text-blue-800">Explanation:</p>
                        <div className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.explanationText) }} />
                      </div>
                    )}

                    <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Author: {mcq.author || 'Unknown'}</span>
                      {mcq.lastRevised && <span>Last revised: {formatDate(mcq.lastRevised)}</span>}
                      <span>Created: {formatDate(mcq.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-400">
                  Page {page} of {pages} · {total} total MCQs
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    <FiChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, pages - 4));
                    const p = start + i;
                    return p <= pages ? (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium ${p === page ? 'bg-indigo-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        {p}
                      </button>
                    ) : null;
                  })}
                  <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default QBMCQListPage;
