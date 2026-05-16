// modules/questionbank/pages/QBMCQListPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiEdit, FiTrash, FiEdit3, FiInfo, FiLock, FiArrowLeft, FiFlag,
  FiChevronLeft, FiChevronRight, FiLoader,
} from 'react-icons/fi';
import { fixImageUrls } from '../../../shared/utils/fixImageUrls';
import apiClient from '../../../core/api/axiosConfig';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

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
      Easy:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      Hard:   'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
      Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${map[d] || map.Medium}`}>
        {d || 'Medium'}
      </span>
    );
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : 'N/A';

  const backUrl    = `/admin/question-banks/${qbId}`;
  const editAllParams = new URLSearchParams();
  if (topicId)        editAllParams.set('topicId',   topicId);
  else if (chapterId) editAllParams.set('chapterId', chapterId);
  else if (subjectId) editAllParams.set('subjectId', subjectId);
  const editAllUrl = `/admin/question-banks/${qbId}/mcqs/edit-all/0?${editAllParams}`;

  // Header action — back button
  const headerAction = useMemo(() => (
    <button
      onClick={() => navigate(backUrl)}
      className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] group"
    >
      <FiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
      Back to Question Bank
    </button>
  ), [navigate, backUrl]);

  usePageHeader({
    title:    `MCQ Bank: ${topicTitle}`,
    subtitle: total > 0 ? `${total} question${total !== 1 ? 's' : ''} in this scope` : 'No MCQs in this scope',
    action:   headerAction,
  });

  if (loading && mcqs.length === 0) {
    return (
      <div className="flex justify-center items-center py-16">
        <FiLoader className="animate-spin w-8 h-8 text-[var(--text-faint)]" />
        <span className="ml-3 text-sm text-[var(--text-muted)]">Loading MCQs…</span>
      </div>
    );
  }

  return (
    <div>
      {/* Mobile-only back */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => navigate(backUrl)}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <FiArrowLeft className="w-4 h-4" />
          Back to Question Bank
        </button>
      </div>

      {/* Header summary card */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 mb-5">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">Scope</p>
            <p className="font-display text-lg font-extrabold text-[var(--text-strong)] mt-0.5">
              {topicTitle}
            </p>
          </div>
          {total > 0 && (
            <Link
              to={editAllUrl}
              className="btn-brand text-sm"
            >
              <FiEdit3 className="w-4 h-4" /> Edit All MCQs
            </Link>
          )}
        </div>

        {total > 0 && (
          <div className="flex gap-4 mt-4 text-sm flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />Easy: {stats.easy}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-500" />Medium: {stats.medium}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500" />Hard: {stats.hard}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)] text-xs font-semibold">
              <FiLock className="w-3 h-3" />Private: {stats.private}
            </span>
          </div>
        )}
      </div>

      {/* MCQ List */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6">
        {loading && mcqs.length > 0 && (
          <div className="flex justify-center py-3">
            <FiLoader className="animate-spin w-6 h-6 text-primary-500" />
          </div>
        )}

        {!loading && total === 0 ? (
          <div className="text-center py-16">
            <FiInfo className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-3" />
            <p className="text-[var(--text-muted)]">No MCQs in this scope yet.</p>
            <button
              onClick={() => navigate(`/admin/question-banks/${qbId}/import`)}
              className="mt-3 text-sm text-primary-600 dark:text-primary-300 hover:underline font-medium"
            >
              Import MCQs
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {mcqs.map((mcq, idx) => {
                const globalIdx = (page - 1) * PAGE_SIZE + idx;
                return (
                  <div
                    key={mcq._id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="bg-[var(--bg-muted)] rounded-full w-8 h-8 flex items-center justify-center text-[var(--text-strong)] font-semibold flex-shrink-0">
                          {globalIdx + 1}
                        </div>
                        {getDifficultyBadge(mcq.difficulty)}
                        {mcq.isPublic === false && (
                          <span className="flex items-center text-xs text-[var(--text-muted)] bg-[var(--bg-muted)] px-2 py-1 rounded-full">
                            <FiLock className="mr-1" /> Private
                          </span>
                        )}
                        {mcq.revisionCount > 0 && (
                          <span className="flex items-center text-xs text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-full">
                            <FiEdit3 className="mr-1" /> Revised {mcq.revisionCount}×
                          </span>
                        )}
                        {reportCounts[mcq._id] > 0 && (
                          <span className="flex items-center text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 px-2 py-1 rounded-full font-semibold">
                            <FiFlag className="mr-1 w-3 h-3" /> {reportCounts[mcq._id]} report{reportCounts[mcq._id] > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Link
                          to={`/admin/question-banks/${qbId}/mcqs/${mcq._id}/edit?${editAllParams}`}
                          className="p-2 text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <FiEdit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(mcq._id)}
                          className="p-2 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <FiTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="prose max-w-none mb-3 text-[var(--text)] dark:prose-invert">
                      <div dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.questionText) }} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                      {mcq.options?.map((opt) => (
                        <div
                          key={opt._id || opt.optionLetter}
                          className={`p-2 rounded-lg flex items-start text-sm ${
                            opt.isCorrect
                              ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200'
                              : 'bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text)]'
                          }`}
                        >
                          <span className="font-medium mr-2 flex-shrink-0">{opt.optionLetter}.</span>
                          <span className="inline" dangerouslySetInnerHTML={{ __html: fixImageUrls(opt.optionText) }} />
                        </div>
                      ))}
                    </div>

                    {mcq.explanationText && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg mb-3">
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Explanation:</p>
                        <div
                          className="prose prose-sm max-w-none text-blue-900 dark:text-blue-100 dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.explanationText) }}
                        />
                      </div>
                    )}

                    <div className="text-xs text-[var(--text-faint)] flex flex-wrap gap-x-4 gap-y-1">
                      <span>Author: {mcq.author || 'Unknown'}</span>
                      {mcq.lastRevised && <span>Last revised: {formatDate(mcq.lastRevised)}</span>}
                      <span>Created: {formatDate(mcq.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border-faint)]">
                <p className="text-sm text-[var(--text-faint)]">
                  Page {page} of {pages} · {total} total MCQs
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-40"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, pages - 4));
                    const p = start + i;
                    return p <= pages ? (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium ${
                          p === page
                            ? 'bg-primary-500 text-white'
                            : 'border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                        }`}
                      >
                        {p}
                      </button>
                    ) : null;
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={page === pages}
                    className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-40"
                  >
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
