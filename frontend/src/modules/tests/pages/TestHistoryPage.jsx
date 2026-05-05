import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiCheckCircle, FiXCircle, FiPlayCircle, FiEye,
  FiBarChart2, FiZap, FiCalendar, FiFilter, FiChevronLeft,
  FiChevronRight, FiSearch, FiBook, FiLayers, FiChevronDown, FiChevronUp, FiX
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';

const PAGE_SIZE = 20;

const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const ScoreBadge = ({ pct }) => {
  const bg = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-orange-500' : 'bg-red-400';
  return (
    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${bg}`}>
      {pct}%
    </div>
  );
};

const StatusBadge = ({ status, scorePercent }) => {
  if (status === 'completed') {
    const passed = scorePercent >= 50;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
        {passed ? <FiCheckCircle className="w-3 h-3" /> : <FiXCircle className="w-3 h-3" />}
        {passed ? 'Passed' : 'Failed'}
      </span>
    );
  }
  if (status === 'in-progress') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
        <FiPlayCircle className="w-3 h-3" /> In Progress
      </span>
    );
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">Abandoned</span>;
};

const TestHistoryPage = () => {
  const navigate = useNavigate();

  const [attempts, setAttempts]         = useState([]);
  const [total, setTotal]               = useState(0);
  const [pages, setPages]               = useState(1);
  const [stats, setStats]               = useState({ total: 0, completed: 0, avgScore: 0 });
  const [filterOptions, setFilterOptions] = useState({ subjects: [], chapters: [], topics: [], qbs: [] });
  const [loading, setLoading]           = useState(true);
  const [showFilters, setShowFilters]   = useState(true);

  // Filter state
  const [searchText, setSearchText]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [modeFilter, setModeFilter]       = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [topicFilter, setTopicFilter]     = useState('all');
  const [qbFilter, setQbFilter]           = useState('all');
  const [dateFilter, setDateFilter]       = useState('all');
  const [page, setPage]                   = useState(1);

  // Debounce search to avoid calling the API on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef(null);
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(searchTimer.current);
  }, [searchText]);

  // Reset to page 1 whenever any filter changes
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, modeFilter, subjectFilter, chapterFilter, topicFilter, qbFilter, dateFilter]);

  // Fetch from server when page or any filter changes
  useEffect(() => {
    const params = new URLSearchParams({ page, limit: PAGE_SIZE });
    if (debouncedSearch)           params.set('search',  debouncedSearch);
    if (statusFilter !== 'all')    params.set('status',  statusFilter);
    if (modeFilter   !== 'all')    params.set('mode',    modeFilter);
    if (subjectFilter !== 'all')   params.set('subject', subjectFilter);
    if (chapterFilter !== 'all')   params.set('chapter', chapterFilter);
    if (topicFilter   !== 'all')   params.set('topic',   topicFilter);
    if (qbFilter      !== 'all')   params.set('qbId',    qbFilter);
    if (dateFilter    !== 'all')   params.set('date',    dateFilter);

    setLoading(true);
    apiClient.get(`/user-tests/history?${params}`)
      .then((res) => {
        setAttempts(res.data.data || []);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 1);
        if (res.data.stats)         setStats(res.data.stats);
        if (res.data.filterOptions) setFilterOptions(res.data.filterOptions);
      })
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, statusFilter, modeFilter, subjectFilter, chapterFilter, topicFilter, qbFilter, dateFilter]);

  const hasActiveFilter = searchText || statusFilter !== 'all' || modeFilter !== 'all' ||
    subjectFilter !== 'all' || chapterFilter !== 'all' || topicFilter !== 'all' ||
    qbFilter !== 'all' || dateFilter !== 'all';

  const clearFilters = () => {
    setSearchText(''); setStatusFilter('all'); setModeFilter('all');
    setSubjectFilter('all'); setChapterFilter('all'); setTopicFilter('all');
    setQbFilter('all'); setDateFilter('all');
  };

  if (loading && attempts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test History</h1>
          <p className="text-sm text-gray-500 mt-0.5">{stats.total} total attempt{stats.total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => navigate('/auto-test')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600"
        >
          <FiZap className="w-4 h-4" /> New Practice Test
        </button>
      </div>

      {/* Summary stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-400 mt-1">Total Tests</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-xs text-gray-400 mt-1">Completed</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-orange-500">{stats.avgScore}%</p>
            <p className="text-xs text-gray-400 mt-1">Avg Score</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <FiFilter className="w-4 h-4" /> Filters
            {hasActiveFilter && (
              <span className="ml-1 px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs">active</span>
            )}
          </div>
          <button onClick={() => setShowFilters((v) => !v)} className="text-gray-400 hover:text-gray-600">
            {showFilters ? <FiChevronUp /> : <FiChevronDown />}
          </button>
        </div>

        {showFilters && (
          <>
            <div className="relative mb-3">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by test name…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="in-progress">In Progress</option>
              </select>

              <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="all">All Modes</option>
                <option value="tutor">Tutor Mode</option>
                <option value="timer">Timed Mode</option>
              </select>

              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {filterOptions.subjects.length > 0 && (
                <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="all">All Subjects</option>
                  {filterOptions.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}

              {filterOptions.chapters.length > 0 && (
                <select value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="all">All Chapters</option>
                  {filterOptions.chapters.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}

              {filterOptions.topics.length > 0 && (
                <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="all">All Topics</option>
                  {filterOptions.topics.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}

              {filterOptions.qbs.length > 0 && (
                <select value={qbFilter} onChange={(e) => setQbFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="all">All QBs</option>
                  {filterOptions.qbs.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
                </select>
              )}
            </div>

            {hasActiveFilter && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">Showing {total} result{total !== 1 ? 's' : ''}</p>
                <button onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500 border border-red-200 hover:bg-red-50">
                  <FiX className="w-3 h-3" /> Clear filters
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Loading overlay for filter changes */}
      {loading && attempts.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
        </div>
      )}

      {/* Empty state */}
      {!loading && attempts.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No tests found</h3>
          <p className="text-sm text-gray-400 mb-6">Try adjusting your filters or create a new practice test.</p>
          <button onClick={() => navigate('/auto-test')} className="px-6 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600">
            Create Practice Test
          </button>
        </div>
      )}

      {/* Attempt cards */}
      {!loading && (
        <div className="space-y-3">
          {attempts.map((attempt) => {
            const testId       = attempt.test?._id || attempt.test;
            const total        = attempt.maxScore || 0;
            const answered     = attempt.answeredCount || 0;
            const scorePercent = attempt.scorePercentage ? Math.round(attempt.scorePercentage) : 0;

            const displaySubjects = attempt.test?.subjects?.length
              ? attempt.test.subjects
              : (attempt.test?.subject ? [attempt.test.subject] : []);
            const displayChapters = attempt.test?.chapters?.length
              ? attempt.test.chapters
              : (attempt.test?.unit ? [attempt.test.unit] : []);
            const qbTitle = attempt.test?.questionBankId?.title;

            return (
              <div key={attempt._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  {attempt.status === 'completed' && <ScoreBadge pct={scorePercent} />}
                  {attempt.status === 'in-progress' && (
                    <div className="w-11 h-11 rounded-full border-4 border-yellow-300 flex items-center justify-center flex-shrink-0">
                      <FiPlayCircle className="w-5 h-5 text-yellow-500" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                      <StatusBadge status={attempt.status} scorePercent={scorePercent} />
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {attempt.mode === 'tutor' ? '🎓 Tutor' : '⏱️ Timed'}
                      </span>
                      {displaySubjects.slice(0, 2).map((s) => (
                        <span key={s} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <FiBook className="w-2.5 h-2.5" />{s}
                        </span>
                      ))}
                      {displayChapters.slice(0, 1).map((c) => (
                        <span key={c} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <FiLayers className="w-2.5 h-2.5" />{c}
                        </span>
                      ))}
                      {qbTitle && (
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">QB: {qbTitle}</span>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-900 truncate text-sm">
                      {attempt.test?.title || 'Untitled Test'}
                    </h3>

                    <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <FiCalendar className="w-3 h-3" /> {formatDate(attempt.createdAt)}
                      </span>
                      {attempt.status === 'completed' && (
                        <span className="font-medium text-gray-600">{attempt.score}/{total} correct</span>
                      )}
                      {attempt.status === 'in-progress' && (
                        <span>{answered}/{total} answered</span>
                      )}
                    </div>

                    {attempt.status === 'in-progress' && total > 0 && (
                      <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-400 rounded-full" style={{ width: `${(answered / total) * 100}%` }} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                  {attempt.status === 'in-progress' && (
                    <button
                      onClick={() => navigate(`/student/tests/${testId}/play?attemptId=${attempt._id}`)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold hover:bg-orange-600"
                    >
                      <FiPlayCircle className="w-4 h-4" /> Resume
                    </button>
                  )}
                  {attempt.status === 'completed' && (
                    <>
                      <button
                        onClick={() => navigate(`/student/tests/${testId}/result/${attempt._id}`)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold hover:bg-orange-600"
                      >
                        <FiBarChart2 className="w-4 h-4" /> Results
                      </button>
                      <button
                        onClick={() => navigate(`/student/tests/${testId}/review/${attempt._id}`)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
                      >
                        <FiEye className="w-4 h-4" /> Review
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => navigate(`/student/tests/${testId}`)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 ml-auto"
                  >
                    Retake
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-400">Page {page} of {pages} ({total} results)</p>
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
                  className={`w-9 h-9 rounded-lg text-sm font-medium ${p === page ? 'bg-orange-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
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
    </div>
  );
};

export default TestHistoryPage;
