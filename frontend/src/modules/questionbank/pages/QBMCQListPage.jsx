// modules/questionbank/pages/QBMCQListPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiEdit, FiTrash, FiEdit3, FiInfo, FiLock, FiArrowLeft, FiFlag,
  FiChevronLeft, FiChevronRight, FiLoader, FiPlus, FiSearch, FiX,
  FiFilter, FiImage,
} from 'react-icons/fi';
import { fixImageUrls } from '../../../shared/utils/fixImageUrls';
import apiClient from '../../../core/api/axiosConfig';
import QBClassificationPicker from '../../../shared/components/QBClassificationPicker';
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

  // Search — `search` is what the input shows; `debouncedSearch` is what we
  // actually query with (300ms after the last keystroke) so we don't hit the
  // API on every character. Server-side so it spans ALL pages, not just the
  // current one. Auto-focus when arriving via the QB-wide "Search MCQs" entry.
  const [search, setSearch]                 = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const focusSearch = searchParams.get('focusSearch') === '1';

  // Advanced filters. Classification (subject/chapter/topic) starts from the
  // URL scope but is then fully editable here via the cascading picker, so the
  // admin can re-scope without navigating. The rest are extra server-side
  // filters (difficulty, visibility, has-image, min revisions, min reports).
  const [classification, setClassification] = useState({
    subjectId: subjectId || '',
    chapterId: chapterId || '',
    topicId:   topicId   || '',
  });
  const [difficulty, setDifficulty]   = useState('');   // '' | Easy | Medium | Hard
  const [visibility, setVisibility]   = useState('');   // '' | public | private
  const [hasImage, setHasImage]       = useState(false);
  // Numeric filters — typed by the admin. Debounced before querying so typing
  // "100" doesn't fire three requests.
  const [minRevisions, setMinRevisions] = useState(''); // '' or a number string
  const [minReports, setMinReports]     = useState(''); // '' or a number string
  const [wrongPct, setWrongPct]         = useState(''); // % of attempts that picked a wrong option
  const [minAttempts, setMinAttempts]   = useState(''); // min total attempts (pairs with wrongPct)
  const [filtersOpen, setFiltersOpen]   = useState(focusSearch);

  // Debounced copy of every numeric filter — drives the actual query.
  const [debNums, setDebNums] = useState({ minRevisions: '', minReports: '', wrongPct: '', minAttempts: '' });
  useEffect(() => {
    const t = setTimeout(() => setDebNums({ minRevisions, minReports, wrongPct, minAttempts }), 350);
    return () => clearTimeout(t);
  }, [minRevisions, minReports, wrongPct, minAttempts]);

  const hasActiveFilter = !!(
    classification.subjectId || classification.chapterId || classification.topicId ||
    difficulty || visibility || hasImage || minRevisions || minReports || wrongPct || minAttempts
  );

  const clearFilters = () => {
    setClassification({ subjectId: '', chapterId: '', topicId: '' });
    setDifficulty(''); setVisibility(''); setHasImage(false);
    setMinRevisions(''); setMinReports(''); setWrongPct(''); setMinAttempts('');
    setSearch('');
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when ANY filter changes.
  useEffect(() => { setPage(1); }, [
    qbId, debouncedSearch,
    classification.subjectId, classification.chapterId, classification.topicId,
    difficulty, visibility, hasImage,
    debNums.minRevisions, debNums.minReports, debNums.wrongPct, debNums.minAttempts,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMcqs(page);
  }, [
    page, qbId, debouncedSearch,
    classification.subjectId, classification.chapterId, classification.topicId,
    difficulty, visibility, hasImage,
    debNums.minRevisions, debNums.minReports, debNums.wrongPct, debNums.minAttempts,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMcqs = async (pg) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit: PAGE_SIZE });
      // Classification — most specific level wins (matches backend precedence).
      if (classification.topicId)        params.append('topicId',   classification.topicId);
      else if (classification.chapterId) params.append('chapterId', classification.chapterId);
      else if (classification.subjectId) params.append('subjectId', classification.subjectId);
      if (debouncedSearch)               params.append('search', debouncedSearch);
      if (difficulty)                    params.append('difficulty', difficulty);
      if (visibility)                    params.append('visibility', visibility);
      if (hasImage)                      params.append('hasImage', '1');
      if (debNums.minRevisions)          params.append('minRevisions', debNums.minRevisions);
      if (debNums.minReports)            params.append('minReports', debNums.minReports);
      if (debNums.wrongPct)              params.append('wrongPct', debNums.wrongPct);
      if (debNums.minAttempts)           params.append('minAttempts', debNums.minAttempts);

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
  // Edit-All + Add-Single follow the LIVE classification filter (which starts
  // from the URL scope but the admin may re-scope via the picker), so the next
  // page lands in the same scope the admin is currently viewing.
  const editAllParams = new URLSearchParams();
  if (classification.topicId)        editAllParams.set('topicId',   classification.topicId);
  else if (classification.chapterId) editAllParams.set('chapterId', classification.chapterId);
  else if (classification.subjectId) editAllParams.set('subjectId', classification.subjectId);
  const editAllUrl = `/admin/question-banks/${qbId}/mcqs/edit-all/0?${editAllParams}`;

  // "Add single MCQ" reuses MCQFormPage in QB-create mode. We carry all known
  // classification ids so the picker pre-fills; admin can still change any level.
  const createParams = new URLSearchParams();
  if (classification.topicId)   createParams.set('topicId',   classification.topicId);
  if (classification.chapterId) createParams.set('chapterId', classification.chapterId);
  if (classification.subjectId) createParams.set('subjectId', classification.subjectId);
  const createUrl = `/admin/question-banks/${qbId}/mcqs/create?${createParams}`;

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
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={createUrl}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              <FiPlus className="w-4 h-4" /> Add Single MCQ
            </Link>
            {total > 0 && (
              <Link
                to={editAllUrl}
                className="btn-brand text-sm"
              >
                <FiEdit3 className="w-4 h-4" /> Edit All MCQs
              </Link>
            )}
          </div>
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

      {/* Search + Filters — all server-side, span every page in this scope. */}
      <div className="mb-5 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] w-4 h-4" />
            <input
              type="text"
              autoFocus={focusSearch}
              placeholder="Search MCQs by question or option text…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-faint)] hover:text-[var(--text)]"
                aria-label="Clear search"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
              filtersOpen || hasActiveFilter
                ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
            }`}
          >
            <FiFilter className="w-4 h-4" /> Filters
            {hasActiveFilter && <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
          </button>
        </div>

        {filtersOpen && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
            {/* Classification (Subject → Chapter → Topic). The picker has its
                own card styling + fetches the QB tree by id. */}
            <QBClassificationPicker
              questionBankId={qbId}
              subjectId={classification.subjectId}
              chapterId={classification.chapterId}
              topicId={classification.topicId}
              onChange={setClassification}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Difficulty */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <option value="">Any</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <option value="">Any</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>

              {/* Min revisions — typed number, "at least N times" */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Revised at least (times)</label>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="Any"
                  value={minRevisions}
                  onChange={(e) => setMinRevisions(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
                />
              </div>

              {/* Min reports — typed number, "at least N open reports" */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Open reports at least</label>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="Any"
                  value={minReports}
                  onChange={(e) => setMinReports(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
                />
              </div>
            </div>

            {/* "Hard for students" — wrong-option % combined with a minimum
                attempt count. Both derived from each MCQ's answer statistics.
                e.g. wrongPct=50 + minAttempts=100 ⇒ MCQs where ≥50% of at least
                100 attempts picked a wrong option. */}
            <div className="rounded-xl border border-[var(--border-faint)] bg-[var(--bg-muted)]/40 p-3">
              <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">
                Students answered wrong (from answer statistics)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--text-faint)] mb-1">Wrong-option % at least</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      inputMode="numeric"
                      placeholder="e.g. 50"
                      value={wrongPct}
                      onChange={(e) => setWrongPct(e.target.value)}
                      className="w-full pl-3 pr-7 py-2 text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-faint)]">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-faint)] mb-1">Attempts at least</label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    placeholder="e.g. 100"
                    value={minAttempts}
                    onChange={(e) => setMinAttempts(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              {/* Has image toggle */}
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasImage}
                  onChange={(e) => setHasImage(e.target.checked)}
                  className="w-4 h-4 accent-primary-500"
                />
                <FiImage className="w-4 h-4 text-[var(--text-muted)]" />
                Only MCQs with an image
              </label>

              {hasActiveFilter && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 text-sm text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 font-medium"
                >
                  <FiX className="w-4 h-4" /> Clear all filters
                </button>
              )}
            </div>
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
            {(debouncedSearch || hasActiveFilter) ? (
              <>
                <p className="text-[var(--text-muted)]">No MCQs match the current search/filters.</p>
                <button
                  onClick={clearFilters}
                  className="mt-3 text-sm text-primary-600 dark:text-primary-300 hover:underline font-medium"
                >
                  Clear all filters
                </button>
              </>
            ) : (
              <>
                <p className="text-[var(--text-muted)]">No MCQs in this scope yet.</p>
                <button
                  onClick={() => navigate(`/admin/question-banks/${qbId}/import`)}
                  className="mt-3 text-sm text-primary-600 dark:text-primary-300 hover:underline font-medium"
                >
                  Import MCQs
                </button>
              </>
            )}
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
